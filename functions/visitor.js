// Cloudflare Pages: GET /visitor. No KV, archives, tracking, or GitHub writes.
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
            redirect: "error", signal: controller.signal, cache: "no-store"
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
export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    if (url.protocol !== "https:") return reply({ error: "https_required" }, 400);
    const origin = request.headers.get("Origin");
    if ((origin && origin !== url.origin) ||
        request.headers.get("Sec-Fetch-Site") === "cross-site") {
        return reply({ error: "origin_not_allowed" }, 403);
    }
    if (request.method !== "GET") {
        return reply({ error: "method_not_allowed" }, 405, { "Allow": "GET" });
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
