// ============================================================
//  functions/track.js  — Cloudflare Pages Function
//  POST /track  → کلیک + snapshot تێکست، سەردان، Textarea
//  GET  /track  → خوێندنەوەی هەموو ئامارەکان (بۆ ئەدمین)
// ============================================================

const ALLOWED_ORIGIN = "https://arkandara.github.io";

function corsHeaders(origin) {
    const allowed = [ALLOWED_ORIGIN, "https://arkandara.pages.dev"].includes(origin) ? origin : "null";
    return {
        "Access-Control-Allow-Origin":  allowed,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Request",
        "Content-Type":                 "application/json; charset=utf-8",
        "Cache-Control":                "no-store",
        "X-Content-Type-Options":        "nosniff",
        "Vary":                         "Origin, Authorization"
    };
}

// ---- بەراستی توکنی Bearer ----
export async function isAdminRequest(request, env) {
    try { return !!await readAdminSession(request, env); }
    catch { return false; }
}

const ADMIN_COOKIE = "__Host-admin_session";
const SESSION_AGE = 8 * 3600;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const authReady = new WeakMap();
async function authDatabase(env) {
    const db = env && env.VISITOR_DB;
    if (!db || typeof db.prepare !== "function") throw invalid("login_not_configured", 503);
    let ready = authReady.get(db);
    if (!ready) {
        ready = db.batch([
            db.prepare("CREATE TABLE IF NOT EXISTS app_admin_auth (id INTEGER PRIMARY KEY CHECK(id = 1), username TEXT NOT NULL, verifier TEXT NOT NULL, generation TEXT NOT NULL)"),
            db.prepare("CREATE TABLE IF NOT EXISTS app_admin_sessions (id TEXT PRIMARY KEY, generation TEXT NOT NULL, expires INTEGER NOT NULL)"),
            db.prepare("CREATE INDEX IF NOT EXISTS app_admin_sessions_expiry ON app_admin_sessions(expires)")
        ]).then(results => { if (!results.every(result => result.success)) throw invalid("login_not_configured", 503); })
            .catch(error => { authReady.delete(db); throw error; });
        authReady.set(db, ready);
    }
    await ready;
    return db;
}
function cookieValue(request) {
    const values = (request.headers.get("Cookie") || "").split(";").map(part => part.trim()).filter(part => part.startsWith(ADMIN_COOKIE + "="));
    return values.length === 1 ? values[0].slice(ADMIN_COOKIE.length + 1) : "";
}
function adminCookie(value = "", age = 0) {
    return ADMIN_COOKIE + "=" + value + "; Max-Age=" + age + "; Path=/; Secure; HttpOnly; SameSite=Strict";
}
function hex(bytes) { return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, "0")).join(""); }
async function sessionKey(env) {
    if (typeof env.ADMIN_TOKEN !== "string" || !env.ADMIN_TOKEN) throw invalid("login_not_configured", 503);
    return crypto.subtle.importKey("raw", new TextEncoder().encode(env.ADMIN_TOKEN), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function readAdminSession(request, env) {
    if (new URL(request.url).protocol !== "https:") return null;
    const parts = cookieValue(request).split(".");
    if (parts.length !== 4 || parts[0] !== "v1" || !SESSION_ID.test(parts[1]) || !/^\d{10}$/.test(parts[2]) || !/^[0-9a-f]{64}$/.test(parts[3])) return null;
    const now = Math.floor(Date.now() / 1000), expires = Number(parts[2]);
    if (expires <= now || expires > now + SESSION_AGE) return null;
    const mac = Uint8Array.from(parts[3].match(/../g), n => parseInt(n, 16));
    if (!await crypto.subtle.verify("HMAC", await sessionKey(env), mac, new TextEncoder().encode(parts.slice(0, 3).join(".")))) return null;
    const db = await authDatabase(env);
    const row = await db.prepare("SELECT app_admin_auth.username AS username, app_admin_auth.generation AS generation, app_admin_sessions.expires AS expires FROM app_admin_sessions JOIN app_admin_auth ON app_admin_auth.id = 1 AND app_admin_auth.generation = app_admin_sessions.generation WHERE app_admin_sessions.id = ? AND app_admin_sessions.expires = ? AND app_admin_sessions.expires > ?")
        .bind(parts[1], expires, now).first();
    return row ? { ...row, sessionId: parts[1] } : null;
}
async function issueSession(env, db, state, cors) {
    const now = Math.floor(Date.now() / 1000), expires = now + SESSION_AGE;
    const id = crypto.randomUUID(), payload = ["v1", id, expires].join(".");
    const signature = hex(await crypto.subtle.sign("HMAC", await sessionKey(env), new TextEncoder().encode(payload)));
    // Guard against a concurrent credential change between password verification and insertion.
    const result = await db.prepare("INSERT INTO app_admin_sessions (id, generation, expires) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM app_admin_auth WHERE id = 1 AND generation = ?)")
        .bind(id, state.generation, expires, state.generation).run();
    if (!result.success || result.meta.changes !== 1) throw invalid("credentials_changed", 409);
    await db.prepare("DELETE FROM app_admin_sessions WHERE expires <= ?").bind(now).run();
    return new Response(JSON.stringify({ success: true, username: state.username, expiresAt: expires }), {
        status: 200, headers: { ...cors, "Set-Cookie": adminCookie(payload + "." + signature, SESSION_AGE) }
    });
}
function username(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim().normalize("NFKC");
    return /^[\p{L}\p{N}_.-]{3,64}$/u.test(normalized) ? normalized : "";
}
async function passwordVerifier(hash, existingSalt) {
    const salt = existingSalt || crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(hash), "PBKDF2", false, ["deriveBits"]);
    const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
    return "pbkdf2:100000:" + hex(salt) + ":" + hex(derived);
}
async function verifyPassword(hash, verifier) {
    if (typeof verifier !== "string" || !/^pbkdf2:100000:[0-9a-f]{32}:[0-9a-f]{64}$/.test(verifier)) return false;
    const salt = Uint8Array.from(verifier.split(":")[2].match(/../g), n => parseInt(n, 16));
    return sameSecret(await passwordVerifier(hash, salt), verifier);
}

async function sameSecret(a, b) {
    const enc = new TextEncoder();
    const hashes = await Promise.all([a, b].map(value => crypto.subtle.digest("SHA-256", enc.encode(value))));
    const left = new Uint8Array(hashes[0]), right = new Uint8Array(hashes[1]);
    let difference = 0;
    for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
    return difference === 0;
}

function invalid(message = "invalid_body", status = 400) {
    return Object.assign(new Error(message), { status });
}
async function readBody(request, limit) {
    if (!request.body) throw invalid();
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) { await reader.cancel(); throw invalid("body_too_large", 413); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let body;
    try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw invalid(); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid();
    return body;
}

// Persist counters in the existing private D1 binding, shared by all isolates.
// IPs are keyed with a server secret; no raw address is stored in this table.
const rateReady = new WeakMap();
const rateCleaned = new WeakMap();
async function rateLimit(env, request, scope, limit, seconds) {
    const db = env.VISITOR_DB;
    if (!db || typeof db.prepare !== "function" || !env.ADMIN_TOKEN) throw invalid("rate_limit_unavailable", 503);
    let ready = rateReady.get(db);
    if (!ready) {
        ready = db.prepare("CREATE TABLE IF NOT EXISTS track_rate_limits (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, hits INTEGER NOT NULL)").run()
            .then(result => { if (!result.success) throw invalid("rate_limit_unavailable", 503); })
            .catch(error => { rateReady.delete(db); throw error; });
        rateReady.set(db, ready);
    }
    await ready;
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / seconds) * seconds;
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.ADMIN_TOKEN + "|" + scope + "|" + ip));
    const key = Array.from(new Uint8Array(keyBytes), n => n.toString(16).padStart(2, "0")).join("");
    const row = await db.prepare("INSERT INTO track_rate_limits (key, bucket, hits) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET hits = CASE WHEN track_rate_limits.bucket = excluded.bucket THEN track_rate_limits.hits + 1 ELSE 1 END, bucket = excluded.bucket RETURNING hits")
        .bind(key, bucket).first();
    if (!row || !Number.isInteger(row.hits)) throw invalid("rate_limit_unavailable", 503);
    if (row.hits > limit) throw Object.assign(invalid("too_many_requests", 429), { retryAfter: bucket + seconds - now });
    if ((rateCleaned.get(db) || 0) < now - 3600) {
        rateCleaned.set(db, now);
        try { await db.prepare("DELETE FROM track_rate_limits WHERE bucket < ?").bind(now - 86400).run(); }
        catch { rateCleaned.delete(db); }
    }
}

function textField(body, key, max, required = false) {
    if (body[key] === undefined && !required) return;
    if (typeof body[key] !== "string" || body[key].length > max || (required && !body[key].trim())) throw invalid("invalid_" + key);
}
function validateBody(body, type) {
    if (["click", "textarea", "preview"].includes(type)) textField(body, "text", 20000, type !== "click");
    if (type === "click") textField(body, "label", 120, true);
    if (type === "textarea") textField(body, "method", 80);
    if (type === "preview") textField(body, "time", 40);
    if (type === "visit") {
        for (const field of ["city", "country", "region", "district", "zip", "isp", "ip", "device", "referrer", "timezone"]) textField(body, field, field === "referrer" ? 512 : 160);
        for (const [field, max] of [["lat", 90], ["lon", 180]]) {
            const value = body[field];
            if (value === undefined || value === "") continue;
            if (!["number", "string"].includes(typeof value) || (typeof value === "string" && !/^-?\d{1,3}(?:\.\d{1,12})?$/.test(value)) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > max) throw invalid("invalid_" + field);
            body[field] = Number(value);
        }
    }
    if (type === "admin_pass_verify" && (typeof body.passHash !== "string" || !/^[0-9a-f]{64}$/.test(body.passHash) || !username(body.username))) throw invalid("invalid_credentials");
    if (type === "admin_pass_set" && (typeof body.oldHash !== "string" || !/^[0-9a-f]{64}$/.test(body.oldHash) || (body.newHash !== undefined && (typeof body.newHash !== "string" || !/^[0-9a-f]{64}$/.test(body.newHash))) || !username(body.username))) throw invalid("invalid_credentials");
    if (type === "snapshots_replace") {
        if (!Array.isArray(body.snaps) || body.snaps.length > 200) throw invalid("invalid_snapshots");
        for (const snap of body.snaps) {
            if (!snap || typeof snap !== "object" || Array.isArray(snap)) throw invalid("invalid_snapshot");
            textField(snap, "text", 20000); textField(snap, "preview", 20000); textField(snap, "label", 120); textField(snap, "time", 40);
        }
    }
    if (type === "news_snapshot") textField(body, "snapshotId", 100);
    if (type === "settings") {
        for (const field of ["rssSources", "customHeadlines", "toolbarBtns"]) {
            if (body[field] !== undefined && (!Array.isArray(body[field]) || body[field].length > 100)) throw invalid("invalid_" + field);
        }
        for (const item of [...(body.rssSources || []), ...(body.toolbarBtns || [])]) {
            if (!item || typeof item !== "object" || Array.isArray(item)) throw invalid("invalid_setting");
            if (item.url) {
                let url; try { url = new URL(item.url); } catch { throw invalid("invalid_url"); }
                if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw invalid("invalid_url");
            }
        }
        if (body.sitemapLastmod !== undefined && (typeof body.sitemapLastmod !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.sitemapLastmod))) throw invalid("invalid_date");
    }
}

// ---- GET: خوێندنەوەی ئامارەکان ----
export async function onRequestGet(context) {
    const { env, request } = context;
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;
    const CORS = corsHeaders(origin);

    if (new URL(request.url).searchParams.get("admin") === "session") {
        try {
            const session = await readAdminSession(request, env);
            return new Response(JSON.stringify(session ? { authenticated: true, username: session.username, expiresAt: session.expires } : { authenticated: false }), {
                status: session ? 200 : 401, headers: CORS
            });
        } catch { return new Response(JSON.stringify({ error: "session_unavailable" }), { status: 503, headers: CORS }); }
    }

    // وێنەکانی ئەپ — گشتی (بۆ مۆداڵی «بەرهەمی دیکە»)
    if (new URL(request.url).searchParams.get("appshots") === "1") {
        const raw = await env.STATS_DB.get("settings:app_screenshots");
        return new Response(JSON.stringify({ images: safeJson(raw, []) }), { status: 200, headers: CORS });
    }

    // بەبێ توکن — forceReload و settings بگەڕێنە (بۆ سایتی سەرەکی)
    if (!await isAdminRequest(request, env)) {
        if (request.headers.get("X-Admin-Request") === "1" || new URL(request.url).searchParams.get("full") === "1") return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
        const url = new URL(request.url);

        // newscheck: snapshot ID ی هەواڵەکان بگەڕێنە
        if (url.searchParams.get("newscheck") === "1") {
            const snap = await env.STATS_DB.get("news:snapshot_id");
            return new Response(JSON.stringify({ snapshotId: snap || "0" }), { status: 200, headers: CORS });
        }

        const forceReload  = await env.STATS_DB.get("meta:force_reload");
        const settingsRaw  = await env.STATS_DB.get("settings:site");
        const settings     = safeJson(settingsRaw, null);
        return new Response(JSON.stringify({ forceReload: forceReload || null, settings }), { status: 200, headers: CORS });
    }

    try{
        const url  = new URL(request.url);
        const full = url.searchParams.get("full") === "1";

        const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
        const clickLabels   = safeJson(clicksListRaw, []);
        const clicks = {};
        for (const label of clickLabels) {
            const val = await env.STATS_DB.get("click:" + label);
            if (val) clicks[label] = parseInt(val) || 0;
        }

        const totalVisits   = parseInt(await env.STATS_DB.get("meta:total_visits")   || "0");
        const totalTextarea = parseInt(await env.STATS_DB.get("meta:total_textarea") || "0");

        const archiveListRaw = await env.STATS_DB.get("meta:archive_list");
        const archiveList    = safeJson(archiveListRaw, []);

        const previewRaw = await env.STATS_DB.get("preview:latest");
        const preview    = safeJson(previewRaw, null);

        const settingsRaw = await env.STATS_DB.get("settings:site");
        const settings    = safeJson(settingsRaw, null);

        // kvUsage: list() لابرا چونکە سنووری ڕۆژانەی Cloudflare تەواو دەکات
        const kvUsage  = { keyCount: "---", usedMB: "---", maxMB: "1024", percent: "---" };

        let recentSessions = [], snapshots = [], textareaToday = [];
        if (full) {
            const sessions = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const raw = await env.STATS_DB.get("visits:" + isoDate(d));
                sessions.push(...safeJson(raw, []));
            }
            recentSessions = sessions
                .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
                .slice(0, 200);

            const snapshotRaw = await env.STATS_DB.get("snapshots:" + isoDate(new Date()));
            snapshots         = safeJson(snapshotRaw, []);

            const txRaw   = await env.STATS_DB.get("textarea:" + isoDate(new Date()));
            textareaToday = safeJson(txRaw, []);
        }

        const forceReload = await env.STATS_DB.get("meta:force_reload");
        return ok({ clicks, totalVisits, totalTextarea, recentSessions, snapshots, textareaToday, archiveList, preview, settings, kvUsage, forceReload }, CORS);

    } catch (err) {
        return err500(err, CORS);
    }
}

// ---- POST: تۆمارکردن ----
export async function onRequestPost(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;
    const CORS = corsHeaders(origin);

    try {
        const url = new URL(request.url);
        if (url.protocol !== "https:") return new Response(JSON.stringify({ error: "https_required" }), { status: 400, headers: CORS });
        const suppliedOrigin = request.headers.get("Origin");
        if (!suppliedOrigin || ![url.origin, ALLOWED_ORIGIN].includes(suppliedOrigin)) return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers: CORS });
        if ((request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase() !== "application/json") return new Response(JSON.stringify({ error: "json_required" }), { status: 415, headers: CORS });
        const authenticated = await isAdminRequest(request, env);
        const body = await readBody(request, authenticated ? 5000000 : 32768);
        const type = body.type || "click";
        if (typeof type !== "string") throw invalid("invalid_type");

        // ئەم typeانە بێ توکن کار دەکەن (سایتی خۆی دەیان نێردرێت)
        const publicTypes = ["click", "visit", "textarea", "preview", "admin_pass_verify", "admin_logout"];

        if ((authenticated || type.startsWith("admin_")) && suppliedOrigin !== url.origin) return new Response(JSON.stringify({ error: "origin_not_allowed" }), { status: 403, headers: CORS });

        if (type === "admin_logout") {
            const session = await readAdminSession(request, env);
            if (session) {
                const db = await authDatabase(env);
                const result = await db.prepare("DELETE FROM app_admin_sessions WHERE id = ?").bind(session.sessionId).run();
                if (!result.success) throw invalid("logout_unavailable", 503);
            }
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...CORS, "Set-Cookie": adminCookie() } });
        }

        if (!publicTypes.includes(type)) {
            // هەموو typeی تری ئەدمین: پشکنینی توکن پێویستە
            if (!authenticated) {
                return new Response(JSON.stringify({ error: "مجاز نییە" }), { status: 401, headers: CORS });
            }
        }

        const knownTypes = [...publicTypes, "settings", "app_screenshots_set", "news_snapshot", "snapshots_replace", "force_reload", "daily_clear", "admin_pass_set"];
        if (!knownTypes.includes(type)) return bad("جۆری نادروست", CORS);
        validateBody(body, type);
        if (type === "admin_pass_verify") {
            if (typeof env.ADMIN_TOKEN !== "string" || !env.ADMIN_TOKEN) throw invalid("login_not_configured", 503);
            await rateLimit(env, request, "login", 10, 900);
        } else if (!authenticated) {
            await rateLimit(env, request, "public", 120, 60);
        }

        // ---- کلیک + snapshot تێکست ----
        if (type === "click") {
            const label = (body.label || "").trim();
            if (!label) return bad("label پێویستە", CORS);

            const listRaw = await env.STATS_DB.get("meta:clicks_list");
            const list    = safeJson(listRaw, []);
            if (!Array.isArray(list)) throw invalid("click_registry_unavailable", 503);
            if (!list.includes(label) && list.length >= 200) return bad("click_labels_full", CORS);
            const key     = "click:" + label;
            const current = parseInt(await env.STATS_DB.get(key) || "0");
            await env.STATS_DB.put(key, String(current + 1));
            if (!list.includes(label)) {
                list.push(label);
                await env.STATS_DB.put("meta:clicks_list", JSON.stringify(list));
            }

            const text = (body.text || "").trim();
            if (text.length > 0) {
                const snapKey = "snapshots:" + isoDate(new Date());
                const snaps   = safeJson(await env.STATS_DB.get(snapKey), []);
                snaps.push({ time: new Date().toISOString(), label: label, text: text });
                if (snaps.length > 200) snaps.splice(0, snaps.length - 200);
                await env.STATS_DB.put(snapKey, JSON.stringify(snaps), { expirationTtl: 691200 });
            }

            return ok({ success: true, label, count: current + 1 }, CORS);
        }

        // ---- سەردان ----
        if (type === "visit") {
            const session = {
                time:     new Date().toISOString(),
                city:     body.city     || "---",
                country:  body.country  || "---",
                region:   body.region   || "",
                district: body.district || "",
                zip:      body.zip      || "",
                isp:      body.isp      || "",
                lat:      body.lat      || "",
                lon:      body.lon      || "",
                ip:       body.ip       || "",
                device:   body.device   || "نەناسراو",
                referrer: body.referrer || "ڕاستەوخۆ",
                timezone: body.timezone || ""
            };
            const tot = parseInt(await env.STATS_DB.get("meta:total_visits") || "0");
            await env.STATS_DB.put("meta:total_visits", String(tot + 1));
            const dayKey = "visits:" + isoDate(new Date());
            const daySes = safeJson(await env.STATS_DB.get(dayKey), []);
            daySes.push(session);
            if (daySes.length > 500) daySes.splice(0, daySes.length - 500);
            await env.STATS_DB.put(dayKey, JSON.stringify(daySes), { expirationTtl: 691200 });
            return ok({ success: true, total: tot + 1 }, CORS);
        }

        // ---- Textarea ----
        if (type === "textarea") {
            const text = (body.text || "").trim();
            if (text.length < 1) return bad("دەقەکە بۆشایە", CORS);
            const method = (body.method || "").trim();
            const event  = { time: new Date().toISOString(), length: text.length, text: text, method: method };
            const key    = "textarea:" + isoDate(new Date());
            const events = safeJson(await env.STATS_DB.get(key), []);
            events.push(event);
            if (events.length > 200) events.splice(0, events.length - 200);
            await env.STATS_DB.put(key, JSON.stringify(events), { expirationTtl: 691200 });
            const tot = parseInt(await env.STATS_DB.get("meta:total_textarea") || "0");
            await env.STATS_DB.put("meta:total_textarea", String(tot + 1));
            return ok({ success: true }, CORS);
        }

        // ---- preview ----
        if (type === "preview") {
            const text = (body.text || "").trim();
            if (!text) return bad("دەق بۆشایە", CORS);
            const preview = {
                time: body.time || new Date().toISOString(),
                text: text,
                length: text.length
            };
            await env.STATS_DB.put("preview:latest", JSON.stringify(preview));
            return ok({ success: true }, CORS);
        }

        // ---- ڕێکخستنەکانی سایت (ئەدمین تەنها) ----
        if (type === "settings") {
            const allowed = ["siteName","siteAuthor","siteTitle","siteDesc","primaryColor","bismillahText","bismillahSub","bismillahDuration","updateText","rssSources","customHeadlines","toolbarBtns","glowColor","glowSpeed","glowOpacity","glowBorderWidth","glowBorderSpeed","sitemapLastmod"];
            const data = {};
            allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
            if (!Object.keys(data).length) return bad("داتا بۆشایە", CORS);
            const existing = safeJson(await env.STATS_DB.get("settings:site"), {});
            // Preserve unrelated sections while updating only submitted settings.
            const merged   = Object.assign({}, existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}, data);
            await env.STATS_DB.put("settings:site", JSON.stringify(merged));

            // ئەگەر sitemapLastmod نوێکرا — فایلی sitemap.xml لە GitHub نوێ بکەوە
            if (data.sitemapLastmod && env.GH_PAT) {
                try {
                    const GITHUB_USER = "arkandara";
                    const GITHUB_REPO = "arkandara.github.io";
                    const FILE_PATH   = "sitemap.xml";
                    const BRANCH      = "main";

                    const newXml = `<?xml version="1.0" encoding="UTF-8"?>\r\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\r\n  <url>\r\n    <loc>https://arkandara.pages.dev/</loc>\r\n    <lastmod>${data.sitemapLastmod}</lastmod>\r\n    <changefreq>weekly</changefreq>\r\n    <priority>1.0</priority>\r\n  </url>\r\n</urlset>\r\n`;

                    // SHA ی فایلی ئێستا بخوێنەوە
                    const getRes = await fetch(
                        `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
                        { headers: { "Authorization": `Bearer ${env.GH_PAT}`, "User-Agent": "arkandara-admin" } }
                    );
                    const getJson = await getRes.json();
                    const sha = getJson.sha || "";

                    // فایلەکە نوێ بکەوە
                    await fetch(
                        `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`,
                        {
                            method: "PUT",
                            headers: {
                                "Authorization": `Bearer ${env.GH_PAT}`,
                                "Content-Type": "application/json",
                                "User-Agent": "arkandara-admin"
                            },
                            body: JSON.stringify({
                                message: `sitemap: update lastmod to ${data.sitemapLastmod}`,
                                content: btoa(unescape(encodeURIComponent(newXml))),
                                sha: sha,
                                branch: BRANCH
                            })
                        }
                    );
                } catch (e) {
                    // ئەگەر GitHub نوێکردنەوە شکستی هێنا، باز نەدە — KV پاشەکەوت کراوە
                }
            }

            return ok({ success: true }, CORS);
        }

        // ---- وێنەکانی ئەپ (ئەدمین تەنها) ----
        if (type === "app_screenshots_set") {
            const imgs = Array.isArray(body.images) ? body.images : [];
            if (imgs.length > 5) return bad("زیاتر لە ٥ وێنە ڕێگەپێنەدراوە", CORS);
            for (const im of imgs) {
                if (typeof im !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(im) || im.length > 900000) {
                    return bad("وێنەکە دروست نییە یان زۆر گەورەیە", CORS);
                }
            }
            await env.STATS_DB.put("settings:app_screenshots", JSON.stringify(imgs));
            return ok({ success: true, count: imgs.length }, CORS);
        }

        // ---- news_snapshot: نوێکردنەوەی snapshot_id کاتێک هەواڵی نوێ دەگات ----
        if (type === "news_snapshot") {
            const snapId = body.snapshotId || new Date().toISOString();
            await env.STATS_DB.put("news:snapshot_id", snapId, { expirationTtl: 86400 });
            return ok({ success: true, snapshotId: snapId }, CORS);
        }

        // ---- snapshots_replace (ئەدمین تەنها) ----
        if (type === "snapshots_replace") {
            const snaps = body.snaps || [];
            const dayKey = "snapshots:" + isoDate(new Date());
            await env.STATS_DB.put(dayKey, JSON.stringify(snaps), { expirationTtl: 691200 });
            return ok({ success: true, count: snaps.length }, CORS);
        }

        // ---- force_reload (ئەدمین تەنها) ----
        if (type === "force_reload") {
            await env.STATS_DB.put("meta:force_reload", new Date().toISOString(), { expirationTtl: 300 });
            return ok({ success: true }, CORS);
        }

        // ---- daily_clear (ئەدمین تەنها) — CLEAR_SECRET لە env ----
        if (type === "daily_clear") {
            const secret = body.secret || "";
            const validSecret = env.CLEAR_SECRET || "";
            if (!validSecret || secret !== validSecret) {
                return new Response(JSON.stringify({ error: "مجاز نییە" }), { status: 401, headers: CORS });
            }
            const today = isoDate(new Date());
            await env.STATS_DB.delete("snapshots:" + today);
            await env.STATS_DB.delete("textarea:"  + today);
            await env.STATS_DB.delete("visits:"    + today);
            await env.STATS_DB.put("meta:total_visits",   "0");
            await env.STATS_DB.put("meta:total_textarea", "0");
            const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
            const clickLabels   = safeJson(clicksListRaw, []);
            for (const label of clickLabels) {
                await env.STATS_DB.delete("click:" + label);
            }
            await env.STATS_DB.delete("meta:clicks_list");
            return ok({ success: true, cleared: today }, CORS);
        }

        // Credentials are private D1 state. A generation change revokes every session.
        if (type === "admin_pass_set") {
            await rateLimit(env, request, "credential-change", 10, 900);
            const session = await readAdminSession(request, env);
            if (!session) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
            const db = await authDatabase(env);
            const current = await db.prepare("SELECT username, verifier, generation FROM app_admin_auth WHERE id = 1").first();
            if (!current || current.generation !== session.generation) throw invalid("credentials_changed", 409);
            if (!await verifyPassword(body.oldHash, current.verifier)) return bad("پاسۆردی ئێستا هەڵەیە", CORS);
            const verifier = body.newHash ? await passwordVerifier(body.newHash) : current.verifier;
            const generation = crypto.randomUUID();
            const results = await db.batch([
                db.prepare("UPDATE app_admin_auth SET username = ?, verifier = ?, generation = ? WHERE id = 1 AND generation = ?").bind(username(body.username), verifier, generation, current.generation),
                db.prepare("DELETE FROM app_admin_sessions WHERE generation = ?").bind(current.generation)
            ]);
            if (!results.every(result => result.success)) throw invalid("credentials_unavailable", 503);
            if (results[0].meta.changes !== 1) throw invalid("credentials_changed", 409);
            return new Response(JSON.stringify({ success: true, sessionsRevoked: true }), { status: 200, headers: { ...CORS, "Set-Cookie": adminCookie() } });
        }

        if (type === "admin_pass_verify") {
            const db = await authDatabase(env);
            let state = await db.prepare("SELECT username, verifier, generation FROM app_admin_auth WHERE id = 1").first();
            if (!state) {
                // One-time migration: prove the current password before creating private auth state.
                // There is no public first-user bootstrap and no fallback once D1 state exists.
                const saved = await env.STATS_DB.get("settings:admin_pass_hash");
                const expected = saved || env.DEFAULT_PASS_HASH;
                if (typeof expected !== "string" || !/^[0-9a-f]{64}$/.test(expected)) throw invalid("login_not_configured", 503);
                if (username(body.username) !== "admin" || !await sameSecret(body.passHash, expected)) return new Response(JSON.stringify({ error: "ناو یان پاسۆرد هەڵەیە" }), { status: 401, headers: CORS });
                const result = await db.prepare("INSERT OR IGNORE INTO app_admin_auth (id, username, verifier, generation) VALUES (1, ?, ?, ?)").bind("admin", await passwordVerifier(body.passHash), crypto.randomUUID()).run();
                if (!result.success) throw invalid("login_not_configured", 503);
                state = await db.prepare("SELECT username, verifier, generation FROM app_admin_auth WHERE id = 1").first();
            }
            const [userMatches, passwordMatches] = await Promise.all([
                sameSecret(username(body.username), state.username), verifyPassword(body.passHash, state.verifier)
            ]);
            if (!userMatches || !passwordMatches) return new Response(JSON.stringify({ error: "ناو یان پاسۆرد هەڵەیە" }), { status: 401, headers: CORS });
            return await issueSession(env, db, state, CORS);
        }

                return bad("جۆری نادروست", CORS);

    } catch (err) {
        return err500(err, corsHeaders(context.request.headers.get("Origin") || ALLOWED_ORIGIN));
    }
}

export async function onRequestOptions(context) {
    const origin = context.request.headers.get("Origin") || ALLOWED_ORIGIN;
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function isoDate(d) { return d.toISOString().slice(0, 10); }
function safeJson(raw, def) { try { return raw ? JSON.parse(raw) : def; } catch(e) { return def; } }
function ok(data, cors)  { return new Response(JSON.stringify(data),                 { status: 200, headers: cors }); }
function bad(msg, cors)  { return new Response(JSON.stringify({ error: msg }),       { status: 400, headers: cors }); }
function err500(e, cors) {
    const status = [400, 409, 413, 429, 503].includes(e.status) ? e.status : 500;
    return new Response(JSON.stringify({ error: status === 500 ? "operation_unavailable" : e.message }), {
        status, headers: { ...cors, ...(e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {}) }
    });
}
