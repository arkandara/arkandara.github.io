// ============================================================
//  functions/reload.js  — Cloudflare Pages Function
//  GET /reload  → Server-Sent Events بۆ ریفرێشکردنی سایت
// ============================================================

const ALLOWED_ORIGIN = "https://arkandara.github.io";

export async function onRequestGet(context) {
    const { env, request } = context;
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;
    const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    let lastFlag = null;
    let closed = false;

    // یەکەم: فلاگی ئێستا وەربگرە
    try {
        const current = await env.STATS_DB.get("meta:force_reload");
        lastFlag = current || null;
    } catch(e) {}

    // هەر 2 چرکە چێک بکە
    const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }
        try {
            const flag = await env.STATS_DB.get("meta:force_reload");
            if (flag && flag !== lastFlag) {
                lastFlag = flag;
                await writer.write(encoder.encode("data: reload\n\n"));
            } else {
                // heartbeat بۆ ئەوەی پەیوەندییەکە زیندو بمێنێت
                await writer.write(encoder.encode(": heartbeat\n\n"));
            }
        } catch(e) {
            closed = true;
            clearInterval(interval);
            try { await writer.close(); } catch(_) {}
        }
    }, 2000);

    // کاتێک براوزەر پەیوەندییەکە داخست
    context.waitUntil(
        request.signal?.addEventListener("abort", () => {
            closed = true;
            clearInterval(interval);
            writer.close().catch(() => {});
        })
    );

    return new Response(readable, {
        status: 200,
        headers: {
            "Content-Type":                "text/event-stream",
            "Cache-Control":               "no-cache",
            "Connection":                  "keep-alive",
            "Access-Control-Allow-Origin": allowed,
        }
    });
}

export async function onRequestOptions(context) {
    const origin = context.request.headers.get("Origin") || ALLOWED_ORIGIN;
    const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin":  allowed,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        }
    });
}
