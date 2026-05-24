// ============================================================
//  functions/stats.js  — Cloudflare Pages Function
//  GET /stats  → خوێندنەوەی ئامارەکان (بۆ ئەدمین تەنها)
// ============================================================

const ALLOWED_ORIGIN = "https://arkandara.github.io";

function corsHeaders(origin) {
    const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
    return {
        "Access-Control-Allow-Origin":  allowed,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type":                 "application/json"
    };
}

function checkAuth(request, env) {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return token === (env.ADMIN_TOKEN || "");
}

export async function onRequestGet(context) {
    const { env, request } = context;
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;
    const CORS = corsHeaders(origin);

    if (!checkAuth(request, env)) {
        return new Response(JSON.stringify({ error: "مجاز نییە" }), { status: 401, headers: CORS });
    }

    try {
        const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
        const clickLabels   = clicksListRaw ? JSON.parse(clicksListRaw) : [];
        const clicks = {};
        for (const label of clickLabels) {
            const val = await env.STATS_DB.get("click:" + label);
            if (val) clicks[label] = parseInt(val);
        }

        const totalVisits   = parseInt(await env.STATS_DB.get("meta:total_visits")   || "0");
        const totalTextarea = parseInt(await env.STATS_DB.get("meta:total_textarea") || "0");

        const sessions = [];
        for (let i = 0; i < 7; i++) {
            const d   = new Date();
            d.setDate(d.getDate() - i);
            const key = "visits:" + d.toISOString().slice(0, 10);
            const raw = await env.STATS_DB.get(key);
            if (raw) sessions.push(...JSON.parse(raw));
        }
        const recentSessions = sessions
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 50);

        const txKey         = "textarea:" + todayStr();
        const txRaw         = await env.STATS_DB.get(txKey);
        const textareaToday = txRaw ? JSON.parse(txRaw) : [];

        const archiveListRaw = await env.STATS_DB.get("meta:archive_list");
        const archiveList    = archiveListRaw ? JSON.parse(archiveListRaw) : [];

        return new Response(JSON.stringify({
            clicks, totalVisits, totalTextarea,
            recentSessions, textareaToday, archiveList
        }), { status: 200, headers: CORS });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions(context) {
    const origin = context.request.headers.get("Origin") || ALLOWED_ORIGIN;
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
