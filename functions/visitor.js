// Cloudflare Pages: visitor identity and authenticated blocklist management.
// No KV, archives, or visitor registry. Admin writes ONLY data/blocked-visitors.json.
// GET /visitor?admin=blocklist; POST /visitor {action: block|unblock, visitorId}.
// Admin requires env.ADMIN_TOKEN and env.GH_PAT; no password-hash fallback.
// GitHub commits trigger deployments and raw/CDN enforcement may lag.
// Required secret: VISITOR_SIGNING_SECRET (at least 32 random bytes; keep stable).
// Future blocklist: main:data/blocked-visitors.json, JSON {"blocked":["UUID",...]}.
// Missing, invalid, or unreachable blocklists return 503, never "not blocked".
// This route checks only itself; site-wide enforcement needs separate middleware.
// Cookies identify a browser profile, not a person/device. Clearing them bypasses
// ID-based blocking. Cross-site GitHub Pages -> pages.dev cookies are unreliable;
// call this endpoint from the same HTTPS origin. No cross-origin CORS is enabled.
const COOKIE = "__Host-visitor";
const AGE = 31536000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LIST_URL = "https://raw.githubusercontent.com/arkandara/arkandara.github.io/main/data/blocked-visitors.json";
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
async function blockedIds() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        // No application cache: GitHub/CDN propagation can still delay updates.
        const response = await fetch(LIST_URL, {
            headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
            // Workers supports manual/follow only; non-2xx redirects fail below.
            redirect: "manual", signal: controller.signal, cache: "no-store"
        });
        if (!response.ok || !response.body) throw new Error("unavailable");
        // Bound bytes while streaming, including chunked responses.
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 262144) {
                await reader.cancel();
                throw new Error("oversized");
            }
            chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (!data || !Array.isArray(data.blocked) || data.blocked.length > 5000 ||
            !data.blocked.every(id => typeof id === "string" && UUID.test(id))) {
            throw new Error("invalid");
        }
        return new Set(data.blocked);
    } finally { clearTimeout(timer); }
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
async function githubRequest(env, method, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(CONTENTS_URL + (method === "GET" ? "?ref=main" : ""), {
            method, redirect: "manual", cache: "no-store", signal: controller.signal,
            headers: {
                "Authorization": "Bearer " + env.GH_PAT,
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
                "User-Agent": "arkandara-visitor-admin",
                "X-GitHub-Api-Version": "2022-11-28"
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        if (!response.ok) {
            if (response.body) await response.body.cancel();
            return { status: response.status, data: null };
        }
        return { status: response.status, data: await readBoundedJson(response, 524288) };
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
function encodeContent(text) {
    return btoa(Array.from(encoder.encode(text), byte => String.fromCharCode(byte)).join(""));
}
async function manageBlocklist(request, env) {
    try {
        if (!await isAdmin(request, env)) return reply({ error: "unauthorized" }, 401);
        if (typeof env.GH_PAT !== "string" || !env.GH_PAT) {
            return reply({ error: "github_not_configured" }, 503);
        }
        let change;
        if (request.method === "POST") {
            // Require same-origin JSON, in addition to the non-cookie bearer token.
            if (request.headers.get("Origin") !== new URL(request.url).origin) {
                return reply({ error: "origin_required" }, 403);
            }
            if ((request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase()
                !== "application/json") return reply({ error: "json_required" }, 415);
            try { change = await readBoundedJson(request, 1024); }
            catch { return reply({ error: "invalid_body" }, 400); }
            if (!change || !["block", "unblock"].includes(change.action) ||
                typeof change.visitorId !== "string" || !UUID.test(change.visitorId)) {
                return reply({ error: "invalid_action_or_id" }, 400);
            }
        }
        const current = await githubRequest(env, "GET");
        if (current.status !== 200) return reply({ error: "blocklist_unavailable" }, 503);
        const data = decodeBlocklist(current.data);
        const ids = new Set(data.blocked);
        if (!change) return reply({ blocked: [...ids], source: "github", enforcementMayLag: true });
        const present = ids.has(change.visitorId);
        if (present === (change.action === "block")) {
            return reply({ success: true, changed: false, visitorId: change.visitorId, blocked: present });
        }
        if (change.action === "block") {
            if (ids.size >= 5000) return reply({ error: "blocklist_full" }, 409);
            ids.add(change.visitorId);
        } else { ids.delete(change.visitorId); }
        // Keep unrelated metadata and use the current blob SHA to avoid lost writes.
        data.blocked = [...ids].sort();
        const serialized = JSON.stringify(data, null, 2) + "\n";
        if (encoder.encode(serialized).byteLength > 262144) {
            return reply({ error: "blocklist_full" }, 409);
        }
        const result = await githubRequest(env, "PUT", {
            message: "visitor: " + change.action + " " + change.visitorId,
            branch: "main", sha: current.data.sha,
            content: encodeContent(serialized)
        });
        if (result.status === 409) return reply({ error: "blocklist_conflict_retry" }, 409);
        if (result.status !== 200 && result.status !== 201) {
            return reply({ error: "blocklist_update_failed" }, 503);
        }
        const commit = result.data && result.data.commit && result.data.commit.sha;
        if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit)) {
            return reply({ error: "blocklist_update_unconfirmed" }, 503);
        }
        return reply({ success: true, changed: true, visitorId: change.visitorId,
            blocked: change.action === "block", commit, enforcementMayLag: true });
    } catch { return reply({ error: "blocklist_operation_unavailable" }, 503); }
}

export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    if (url.protocol !== "https:") return reply({ error: "https_required" }, 400);
    const origin = request.headers.get("Origin");
    if ((origin && origin !== url.origin) ||
        request.headers.get("Sec-Fetch-Site") === "cross-site") {
        return reply({ error: "origin_not_allowed" }, 403);
    }
    const adminAction = url.searchParams.get("admin");
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
        try { list = await blockedIds(); }
        catch {
            return reply({ visitorId: identity.id, isNew, blocked: null,
                error: "blocklist_unavailable" }, 503, { ...headers, "Retry-After": "60" });
        }
        const blocked = list.has(identity.id);
        return reply({ visitorId: identity.id, isNew, blocked }, blocked ? 403 : 200, headers);
    } catch {
        return reply({ error: "visitor_unavailable" }, 503);
    }
}
