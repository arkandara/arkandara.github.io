// Root Cloudflare Pages middleware. No KV, archive access, or GitHub writes.
// Staged activation: without a valid VISITOR_SIGNING_SECRET, preserve the existing
// site. Set the SAME stable 32+ byte secret used by visitor.js to enable blocking.
// Once configured, failed blocklist checks return 503 (fail closed).
// Reuse the endpoint directly, never fetch our own /visitor URL (no recursion).
// GitHub Pages itself cannot run this middleware; enforcement is on Pages only.
// Cookie deletion/new browser profiles can bypass browser-ID blocking.
import { onRequest as checkVisitor } from "./visitor.js";

const encoder = new TextEncoder();
function unavailable(request) {
    return new Response(request.method === "HEAD" ? null :
        JSON.stringify({ error: "visitor_check_unavailable" }), {
        status: 503,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Retry-After": "60",
            "X-Content-Type-Options": "nosniff",
            "Vary": "Cookie"
        }
    });
}
function denied(request) {
    const html = `<!doctype html>
<html lang="ckb" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>دەستگەیشتن ڕێگەپێنەدراوە</title></head>
<body><main><h1>دەستگەیشتن ڕێگەپێنەدراوە</h1>
<p>دەستگەیشتنی ئەم وێبگەڕە بۆ سایت ڕاگیراوە.</p>
<p dir="ltr">403 — Access Denied</p></main></body></html>`;
    return new Response(request.method === "HEAD" ? null : html, {
        status: 403,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Vary": "Cookie"
        }
    });
}
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    // Preserve /visitor's public contract, origin checks, and method handling.
    if (url.pathname === "/visitor" || url.pathname === "/visitor/") {
        return context.next();
    }
    const secret = env && env.VISITOR_SIGNING_SECRET;
    if (typeof secret !== "string" || encoder.encode(secret).length < 32) {
        // Deliberately inactive until configured, avoiding a site-wide outage
        // during this separately approved file-by-file rollout.
        return context.next();
    }
    let verdict;
    let cookie;
    try {
        // This is an internal identity check, not a forwarded API request.
        // Use only the browser cookie. Cross-site top-level links may open the
        // site normally; /visitor itself still rejects cross-origin API calls.
        const headers = new Headers();
        const incoming = request.headers.get("Cookie");
        if (incoming) headers.set("Cookie", incoming);
        url.pathname = "/visitor";
        url.search = "";
        const result = await checkVisitor({
            request: new Request(url, { method: "GET", headers }), env
        });
        verdict = await result.json();
        if (result.status === 403 && verdict.blocked === true) return denied(request);
        if (result.status !== 200 || verdict.blocked !== false) return unavailable(request);
        cookie = result.headers.get("Set-Cookie");
    } catch {
        return unavailable(request);
    }
    // Do not catch downstream errors or call next twice.
    const downstream = await context.next();
    const response = new Response(downstream.body, downstream);
    if (cookie) response.headers.append("Set-Cookie", cookie);
    // Browser-specific access decisions must not be reused by shared caches.
    response.headers.set("Cache-Control", "no-store");
    const vary = response.headers.get("Vary");
    if (vary !== "*" && !(vary || "").split(",").some(v => v.trim().toLowerCase() === "cookie")) {
        response.headers.set("Vary", vary ? vary + ", Cookie" : "Cookie");
    }
    return response;
}
