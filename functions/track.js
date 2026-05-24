// ============================================================
//  functions/track.js  — Cloudflare Pages Function
//  POST /track  → کلیک + snapshot تێکست، سەردان، Textarea
//  GET  /track  → خوێندنەوەی هەموو ئامارەکان (بۆ ئەدمین)
// ============================================================

const ALLOWED_ORIGIN = "https://arkandara.github.io";

function corsHeaders(origin) {
    const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
    return {
        "Access-Control-Allow-Origin":  allowed,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type":                 "application/json"
    };
}

// ---- بەراستی توکنی Bearer ----
async function checkAuth(request, env) {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return false;

    // ١. بەراوردی لەگەڵ ADMIN_TOKEN ی env
    const adminToken = env.ADMIN_TOKEN || "";
    if (adminToken && token === adminToken) return true;

    // ٢. ئەگەر ADMIN_TOKEN بەردەست نەبوو — بەراوردی لەگەڵ hash ی پاشەکەوتکراو لە KV
    const savedHash = await env.STATS_DB.get("settings:admin_pass_hash");
    if (savedHash && token === savedHash) return true;

    // ٣. بەراوردی لەگەڵ DEFAULT_PASS_HASH ی env
    const defaultHash = env.DEFAULT_PASS_HASH || "";
    if (defaultHash && token === defaultHash) return true;

    return false;
}

// ---- GET: خوێندنەوەی ئامارەکان (بۆ ئەدمین تەنها) ----
export async function onRequestGet(context) {
    const { env, request } = context;
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;
    const CORS = corsHeaders(origin);

    if (!await checkAuth(request, env)) {
        return new Response(JSON.stringify({ error: "مجاز نییە" }), { status: 401, headers: CORS });
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

        const kvKeys   = await env.STATS_DB.list({ limit: 1000 });
        const keyCount = kvKeys.keys.length;
        const enc      = new TextEncoder();
        let totalBytes = 0;
        for (const k of kvKeys.keys) {
            const val = await env.STATS_DB.get(k.name);
            if (val) totalBytes += enc.encode(val).length;
        }
        const maxBytes = 1024 * 1024 * 1024;
        const usedMB   = (totalBytes / (1024 * 1024)).toFixed(3);
        const maxMB    = (maxBytes   / (1024 * 1024)).toFixed(0);
        const percent  = ((totalBytes / maxBytes) * 100).toFixed(2);
        const kvUsage  = { keyCount, usedMB, maxMB, percent };

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
        const body = await request.json();
        const type = body.type || "click";

        // ئەم typeانە بێ توکن کار دەکەن (سایتی خۆی دەیان نێردرێت)
        const publicTypes = ["click", "visit", "textarea", "preview", "admin_pass_get", "admin_pass_verify"];

        if (!publicTypes.includes(type)) {
            // هەموو typeی تری ئەدمین: پشکنینی توکن پێویستە
            if (!await checkAuth(request, env)) {
                return new Response(JSON.stringify({ error: "مجاز نییە" }), { status: 401, headers: CORS });
            }
        }

        // ---- کلیک + snapshot تێکست ----
        if (type === "click") {
            const label = (body.label || "").trim();
            if (!label) return bad("label پێویستە", CORS);

            const key     = "click:" + label;
            const current = parseInt(await env.STATS_DB.get(key) || "0");
            await env.STATS_DB.put(key, String(current + 1));

            const listRaw = await env.STATS_DB.get("meta:clicks_list");
            const list    = safeJson(listRaw, []);
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
            const allowed = ["siteName","siteAuthor","siteTitle","siteDesc","primaryColor","bismillahText","bismillahSub","updateText","rssSources","toolbarBtns"];
            const data = {};
            allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
            if (!Object.keys(data).length) return bad("داتا بۆشایە", CORS);
            const existing = safeJson(await env.STATS_DB.get("settings:site"), {});
            const merged   = Object.assign({}, existing, data);
            await env.STATS_DB.put("settings:site", JSON.stringify(merged));
            return ok({ success: true }, CORS);
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

        // ---- admin_pass_get (ئەدمین تەنها) ----
        if (type === "admin_pass_get") {
            const hash = await env.STATS_DB.get("settings:admin_pass_hash");
            return ok({ hash: hash || null }, CORS);
        }

        // ---- admin_pass_set (ئەدمین تەنها) ----
        if (type === "admin_pass_set") {
            const oldHash = body.oldHash || "";
            const newHash = body.newHash || "";
            if (!newHash || newHash.length !== 64) return bad("hash نادروستە", CORS);
            const savedHash = await env.STATS_DB.get("settings:admin_pass_hash");
            const defaultHash = env.DEFAULT_PASS_HASH || "";
            const expected = savedHash || defaultHash;
            if (!expected || oldHash !== expected) return bad("پاسۆردی ئێستا هەڵەیە", CORS);
            await env.STATS_DB.put("settings:admin_pass_hash", newHash);
            return ok({ success: true }, CORS);
        }

        // ---- admin_pass_verify: پشکنینی پاسۆرد و گەڕاندنەوەی ADMIN_TOKEN ----
        // ئەمە بێ توکن کار دەکات چونکە پێش لۆگینە
        if (type === "admin_pass_verify") {
            const passHash = body.passHash || "";
            if (!passHash || passHash.length !== 64) return bad("hash نادروستە", CORS);

            // ١. پێشتر لە KV بخوێنەوە
            const savedHash = await env.STATS_DB.get("settings:admin_pass_hash");

            // ٢. ئەگەر KV خاڵی بوو، لە env بخوێنەوە
            const defaultHash = env.DEFAULT_PASS_HASH || "";

            // ٣. ئەگەر هەردووکیان بۆش بوون، هاشەکە بە خۆی لە KV پاشەکەوت بکە (bootstrap)
            let expected = savedHash || defaultHash;

            if (!expected) {
                // ئەگەر هیچ hash ی نەبوو — passHash ی داواکراو بە خۆی وەک hash پاشەکەوت بکە
                // (تەنها یەک جار دەکرێت، bootstrap)
                await env.STATS_DB.put("settings:admin_pass_hash", passHash);
                expected = passHash;
            }

            if (passHash !== expected) {
                return new Response(JSON.stringify({ error: "پاسۆرد هەڵەیە" }), { status: 401, headers: CORS });
            }

            // ئەگەر KV خاڵی بوو و env hash هەبوو — ئێستا لە KV پاشەکەوت بکە بۆ داهاتوو
            if (!savedHash && defaultHash && passHash === defaultHash) {
                await env.STATS_DB.put("settings:admin_pass_hash", passHash);
            }

            // پاسۆرد ڕاستە
            // ADMIN_TOKEN لە env وەک توکن — ئەگەر نەبوو، passHash خۆی وەک توکن بەکاردێت
            const token = env.ADMIN_TOKEN || passHash;
            return ok({ success: true, token: token }, CORS);
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
function err500(e, cors) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors }); }
