// Cloudflare Pages: signed visitor identity, private D1 registry and blocklist.
// No KV, archive access, or GitHub writes. VISITOR_DB is the D1 binding.
// Existing GitHub blocks are imported once, atomically, using server-side GH_PAT.
// After import, all block reads/writes use D1 directly without CDN caching.
// Registry stores UUID + first/last seen; separate private admin labels survive reset.
// Last seen is throttled to 15 minutes. Labels are never returned publicly.
// Daily Baghdad reset at 23:50 preserves blocked rows; recording resumes 23:55.
// Visibility changes by server time; physical cleanup is lazy on the next DB use.
// Admin actions require env.ADMIN_TOKEN; no password-hash fallback.
// Required secret: VISITOR_SIGNING_SECRET (32+ random bytes, kept stable).
// Blocklist/database failure returns 503; registry recording failure is nonfatal.
// Clearing cookies/new browser profiles bypass browser-ID blocking.
// Use the same HTTPS origin for site and admin; no cross-origin CORS is enabled.
const COOKIE = "__Host-visitor";
const AGE = 31536000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const encoder = new TextEncoder();

function reply(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), { status, headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Vary": "Origin, Cookie",
        ...extra
    } });
}
function hex(bytes) {
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
async function signature(key, payload) {
    return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}
async function readIdentity(request, key, now) {
    const values = (request.headers.get("Cookie") || "").split(";")
        .map(s => s.trim()).filter(s => s.startsWith(COOKIE + "="));
    if (values.length !== 1) return null;
    const token = values[0].slice(COOKIE.length + 1);
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [version, id, expiry, mac] = parts;
    if (version !== "v1" || !UUID.test(id) || !/^[0-9]{10}$/.test(expiry) ||
        !/^[0-9a-f]{64}$/.test(mac)) return null;
    if (+expiry <= now || +expiry > now + AGE) return null;
    const bytes = Uint8Array.from(mac.match(/../g), s => parseInt(s, 16));
    if (!await crypto.subtle.verify("HMAC", key, bytes,
        encoder.encode(parts.slice(0, 3).join(".")))) return null;
    return { id, token, expiry: +expiry };
}
async function blockedIds(env, id) {
    const db = await blockDatabase(env);
    // Direct D1 binding queries use the primary database: no replica/CDN cache.
    const row = await db.prepare("SELECT id FROM visitor_blocks WHERE id = ?").bind(id).first();
    return new Set(row ? [row.id] : []);
}

const CONTENTS_URL = "https://api.github.com/repos/arkandara/arkandara.github.io/contents/data/blocked-visitors.json";

async function readBoundedJson(message, limit) {
    if (!message.body) throw new Error("empty_body");
    const reader = message.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) {
                await reader.cancel();
                throw new Error("body_too_large");
            }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
async function isAdmin(request, env) {
    if (typeof env.ADMIN_TOKEN !== "string" || !env.ADMIN_TOKEN) return false;
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ") || authorization.length > 4096) return false;
    const [actual, expected] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(authorization.slice(7))),
        crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_TOKEN))
    ]);
    const a = new Uint8Array(actual), b = new Uint8Array(expected);
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    return difference === 0;
}
// Used only for the one-time import of the existing GitHub blocklist.
async function githubRequest(env) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(CONTENTS_URL + "?ref=main", {
            method: "GET", redirect: "manual", cache: "no-store", signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + env.GH_PAT,
                "Accept": "application/vnd.github+json",
                "User-Agent": "arkandara-visitor-migration",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        });
        if (!response.ok) {
            if (response.body) await response.body.cancel();
            throw new Error("migration_source_unavailable");
        }
        return await readBoundedJson(response, 524288);
    } finally { clearTimeout(timer); }
}

function decodeBlocklist(file) {
    if (!file || file.type !== "file" || file.encoding !== "base64" ||
        !/^[0-9a-f]{40}$/.test(file.sha) || typeof file.content !== "string") {
        throw new Error("invalid_blocklist");
    }
    const raw = atob(file.content.replace(/\s/g, ""));
    if (raw.length > 262144) throw new Error("invalid_blocklist");
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true })
        .decode(Uint8Array.from(raw, ch => ch.charCodeAt(0))));
    if (!data || !Array.isArray(data.blocked) || data.blocked.length > 5000 ||
        !data.blocked.every(id => typeof id === "string" && UUID.test(id))) {
        throw new Error("invalid_blocklist");
    }
    return data;
}

const blockReady = new WeakMap();
async function blockDatabase(env) {
    const db = await visitorDatabase(env);
    let ready = blockReady.get(db);
    if (!ready) {
        ready = (async () => {
            const marker = await db.prepare("SELECT value FROM visitor_meta WHERE key = 'github_blocklist_import_v1'").first();
            if (!marker) {
                if (typeof env.GH_PAT !== "string" || !env.GH_PAT) throw new Error("migration_not_configured");
                const legacy = decodeBlocklist(await githubRequest(env));
                // D1 batch is atomic. Concurrent importers cannot re-add blocks
                // after an unblock: both inserts are guarded by the same marker.
                await db.batch([
                    db.prepare("INSERT OR IGNORE INTO visitor_blocks (id) SELECT value FROM json_each(?) WHERE NOT EXISTS (SELECT 1 FROM visitor_meta WHERE key = 'github_blocklist_import_v1')").bind(JSON.stringify(legacy.blocked)),
                    db.prepare("INSERT OR IGNORE INTO visitor_meta (key, value) VALUES ('github_blocklist_import_v1', 'complete')")
                ]);
            }
        })().catch(error => { blockReady.delete(db); throw error; });
        blockReady.set(db, ready);
    }
    await ready;
    return db;
}
async function manageBlocklist(request, env) {
    try {
        if (!await isAdmin(request, env)) return reply({ error: "unauthorized" }, 401);
        let change;
        if (request.method === "POST") {
            if (request.headers.get("Origin") !== new URL(request.url).origin) {
                return reply({ error: "origin_required" }, 403);
            }
            if ((request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase()
                !== "application/json") return reply({ error: "json_required" }, 415);
            try { change = await readBoundedJson(request, 1024); }
            catch { return reply({ error: "invalid_body" }, 400); }
            if (!change || !["block", "unblock", "label"].includes(change.action) ||
                typeof change.visitorId !== "string" || !UUID.test(change.visitorId)) {
                return reply({ error: "invalid_action_or_id" }, 400);
            }
        }
        if (change && change.action === "label") {
            if (typeof change.name !== "string" || Array.from(change.name).length > 100 ||
                Array.from(change.name).some(character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)) {
                return reply({ error: "invalid_visitor_name" }, 400);
            }
            change.name = change.name.trim();
        }
        const db = await blockDatabase(env);
        if (change && change.action === "label") {
            if (!change.name) {
                const result = await db.prepare("DELETE FROM visitor_labels WHERE id = ?").bind(change.visitorId).run();
                if (!result.success) throw new Error("label_write");
            } else {
                const known = await db.prepare("SELECT id FROM visitor_registry WHERE id = ? UNION SELECT id FROM visitor_blocks WHERE id = ? UNION SELECT id FROM visitor_labels WHERE id = ? LIMIT 1")
                    .bind(change.visitorId, change.visitorId, change.visitorId).first();
                if (!known) return reply({ error: "visitor_not_found" }, 404);
                const result = await db.prepare("INSERT INTO visitor_labels (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name")
                    .bind(change.visitorId, change.name).run();
                if (!result.success) throw new Error("label_write");
            }
            return reply({ success: true, visitorId: change.visitorId, displayName: change.name });
        }
        if (!change) {
            const result = await db.prepare("SELECT id FROM visitor_blocks ORDER BY id").all();
            if (!result.success) throw new Error("query");
            return reply({ blocked: result.results.map(row => row.id), source: "d1", enforcementMayLag: false });
        }
        const statement = change.action === "block"
            ? db.prepare("INSERT OR IGNORE INTO visitor_blocks (id) SELECT ? WHERE (SELECT COUNT(*) FROM visitor_blocks) < 5000").bind(change.visitorId)
            : db.prepare("DELETE FROM visitor_blocks WHERE id = ?").bind(change.visitorId);
        const result = await statement.run();
        if (!result.success) throw new Error("write");
        const changed = result.meta.changes > 0;
        if (change.action === "block" && !changed) {
            const existing = await db.prepare("SELECT id FROM visitor_blocks WHERE id = ?").bind(change.visitorId).first();
            if (!existing) return reply({ error: "blocklist_full" }, 409);
        }
        return reply({ success: true, changed, visitorId: change.visitorId,
            blocked: change.action === "block", source: "d1", enforcementMayLag: false });
    } catch { return reply({ error: "blocklist_operation_unavailable" }, 503); }
}

const registryReady = new WeakMap();
async function visitorDatabase(env) {
    const db = env && env.VISITOR_DB;
    if (!db || typeof db.prepare !== "function") throw new Error("registry_not_configured");
    let ready = registryReady.get(db);
    if (!ready) {
        ready = db.batch([
            db.prepare("CREATE TABLE IF NOT EXISTS visitor_registry (id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL)"),
            db.prepare("CREATE INDEX IF NOT EXISTS visitor_registry_recent ON visitor_registry(last_seen DESC, id DESC)"),
            db.prepare("CREATE TABLE IF NOT EXISTS visitor_blocks (id TEXT PRIMARY KEY)"),
            db.prepare("CREATE TABLE IF NOT EXISTS visitor_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
            db.prepare("CREATE TABLE IF NOT EXISTS visitor_labels (id TEXT PRIMARY KEY, name TEXT NOT NULL)")
        ]).catch(error => { registryReady.delete(db); throw error; });
        registryReady.set(db, ready);
    }
    await ready;
    return db;
}

const registryCleanup = new WeakMap();
// Baghdad is UTC+03:00, without daylight-saving changes.
function registryWindow(now = Math.floor(Date.now() / 1000)) {
    const local = now + 10800;
    const day = Math.floor(local / 86400) * 86400 - 10800;
    const reset = day + 23 * 3600 + 50 * 60;
    const resume = reset + 5 * 60;
    const paused = now >= reset && now < resume;
    return { now, cutoff: now >= reset ? reset : reset - 86400, paused,
        nextTransition: paused ? resume : (now < reset ? reset : reset + 86400) };
}
async function resetAllowedVisitors(db, cutoff) {
    let state = registryCleanup.get(db);
    if (!state || state.cutoff !== cutoff) {
        const promise = (async () => {
            const marker = await db.prepare("SELECT value FROM visitor_meta WHERE key = 'registry_daily_reset'").first();
            if (marker && Number(marker.value) >= cutoff) return;
            // Cleanup runs on first DB use after the boundary. The list's SQL
            // visibility filter enforces the exact boundary even before cleanup.
            await db.batch([
                db.prepare("DELETE FROM visitor_registry WHERE last_seen < ? AND NOT EXISTS (SELECT 1 FROM visitor_blocks WHERE visitor_blocks.id = visitor_registry.id)").bind(cutoff),
                db.prepare("INSERT INTO visitor_meta (key, value) VALUES ('registry_daily_reset', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE CAST(visitor_meta.value AS INTEGER) < CAST(excluded.value AS INTEGER)").bind(String(cutoff))
            ]);
        })().catch(error => { registryCleanup.delete(db); throw error; });
        state = { cutoff, promise };
        registryCleanup.set(db, state);
    }
    await state.promise;
}

// Only a signed server-issued identity reaches this helper. No client-supplied
// IP, user agent, location, page path, text, or name is collected.
export async function recordVisitor(env, id) {
    if (!UUID.test(id)) return false;
    try {
        const db = await visitorDatabase(env);
        const window = registryWindow();
        await resetAllowedVisitors(db, window.cutoff);
        if (window.paused) return false;
        const now = window.now;
        await db.prepare(
            "INSERT INTO visitor_registry (id, first_seen, last_seen) VALUES (?, ?, ?) " +
            "ON CONFLICT(id) DO UPDATE SET first_seen = CASE WHEN visitor_registry.last_seen < ? " +
            "THEN excluded.first_seen ELSE visitor_registry.first_seen END, last_seen = excluded.last_seen " +
            "WHERE visitor_registry.last_seen < excluded.last_seen - 900 OR visitor_registry.last_seen < ?"
        ).bind(id, now, now, window.cutoff, window.cutoff).run();
        return true;
    } catch {
        // Registry outages must not take down the site or alter blocking.
        return false;
    }
}
async function listVisitors(request, env) {
    try {
        if (!await isAdmin(request, env)) return reply({ error: "unauthorized" }, 401);
        if (!env.VISITOR_DB) return reply({ error: "registry_not_configured" }, 503);
        const window = registryWindow();
        let cursor = null;
        const raw = new URL(request.url).searchParams.get("cursor");
        if (raw) {
            try {
                if (raw.length > 200) throw new Error("cursor");
                cursor = JSON.parse(atob(raw));
                if (!Array.isArray(cursor) || cursor.length !== 3 ||
                    !Number.isSafeInteger(cursor[0]) || cursor[0] < 0 ||
                    !Number.isSafeInteger(cursor[1]) || cursor[1] < 0 ||
                    typeof cursor[2] !== "string" || !UUID.test(cursor[2])) throw new Error("cursor");
            } catch { return reply({ error: "invalid_cursor" }, 400); }
        }
        if (cursor && cursor[0] !== window.cutoff) return reply({ error: "registry_period_changed" }, 409);
        const db = await blockDatabase(env);
        await resetAllowedVisitors(db, window.cutoff);
        const visible = "(last_seen >= ? OR EXISTS (SELECT 1 FROM visitor_blocks WHERE visitor_blocks.id = visitor_registry.id))";
        const statement = cursor
            ? db.prepare("SELECT visitor_registry.id AS id, first_seen, last_seen, COALESCE(visitor_labels.name, '') AS display_name FROM visitor_registry LEFT JOIN visitor_labels ON visitor_labels.id = visitor_registry.id WHERE " + visible + " AND (last_seen < ? OR (last_seen = ? AND visitor_registry.id < ?)) ORDER BY last_seen DESC, visitor_registry.id DESC LIMIT 101").bind(window.cutoff, cursor[1], cursor[1], cursor[2])
            : db.prepare("SELECT visitor_registry.id AS id, first_seen, last_seen, COALESCE(visitor_labels.name, '') AS display_name FROM visitor_registry LEFT JOIN visitor_labels ON visitor_labels.id = visitor_registry.id WHERE " + visible + " ORDER BY last_seen DESC, visitor_registry.id DESC LIMIT 101").bind(window.cutoff);
        const result = await statement.all();
        if (!result.success || !Array.isArray(result.results)) throw new Error("query");
        const rows = result.results.slice(0, 100);
        const last = rows[rows.length - 1];
        return reply({
            visitors: rows.map(row => ({ visitorId: row.id, displayName: row.display_name,
                firstSeen: new Date(row.first_seen * 1000).toISOString(),
                lastSeen: new Date(row.last_seen * 1000).toISOString() })),
            nextCursor: result.results.length > 100 && last ? btoa(JSON.stringify([window.cutoff, last.last_seen, last.id])) : null,
            serverTime: window.now, resetCutoff: window.cutoff,
            recordingPaused: window.paused, nextTransition: window.nextTransition,
            timeZone: "Asia/Baghdad", lastSeenResolutionSeconds: 900
        });
    } catch { return reply({ error: "registry_unavailable" }, 503); }
}

export async function onRequest({ request, env, data }) {
    const url = new URL(request.url);
    if (url.protocol !== "https:") return reply({ error: "https_required" }, 400);
    const origin = request.headers.get("Origin");
    if ((origin && origin !== url.origin) ||
        request.headers.get("Sec-Fetch-Site") === "cross-site") {
        return reply({ error: "origin_not_allowed" }, 403);
    }
    const adminAction = url.searchParams.get("admin");
    if (request.method === "GET" && adminAction === "visitors") {
        return listVisitors(request, env || {});
    }
    if (request.method === "POST" || (request.method === "GET" && adminAction === "blocklist")) {
        return manageBlocklist(request, env || {});
    }
    if (request.method !== "GET") {
        return reply({ error: "method_not_allowed" }, 405, { "Allow": "GET, POST" });
    }
    const secret = env && env.VISITOR_SIGNING_SECRET;
    if (typeof secret !== "string" || encoder.encode(secret).length < 32) {
        return reply({ error: "visitor_not_configured" }, 503);
    }
    try {
        const key = await crypto.subtle.importKey("raw", encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
        const now = Math.floor(Date.now() / 1000);
        let identity = await readIdentity(request, key, now);
        const isNew = !identity;
        const headers = {};
        if (!identity) {
            const id = crypto.randomUUID();
            const expiry = now + AGE;
            const payload = ["v1", id, expiry].join(".");
            identity = { id, expiry, token: payload + "." + await signature(key, payload) };
            headers["Set-Cookie"] = COOKIE + "=" + identity.token +
                "; Max-Age=" + AGE + "; Path=/; Secure; HttpOnly; SameSite=Lax";
        }
        let list;
        try { list = await blockedIds(env, identity.id); }
        catch {
            return reply({ visitorId: identity.id, isNew, blocked: null,
                error: "blocklist_unavailable" }, 503, { ...headers, "Retry-After": "60" });
        }
        const blocked = list.has(identity.id);
        const registered = !blocked && !(data && data.skipVisitorRegistration)
            ? await recordVisitor(env, identity.id) : undefined;
        return reply({ visitorId: identity.id, isNew, blocked, registered }, blocked ? 403 : 200, headers);
    } catch {
        return reply({ error: "visitor_unavailable" }, 503);
    }
}
