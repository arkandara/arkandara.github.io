// ============================================================
//  functions/stats.js  — Cloudflare Pages Function
//  خوێندنەوەی هەموو داتاکانی ئامار بۆ پانێڵی ئەدمین
//  GET /stats
// ============================================================

export async function onRequestGet(context) {
    const { env } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    try {
        // ---- کلیکەکان ----
        const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
        const clickLabels   = clicksListRaw ? JSON.parse(clicksListRaw) : [];
        const clicks = {};
        for (const label of clickLabels) {
            const val = await env.STATS_DB.get("click:" + label);
            if (val) clicks[label] = parseInt(val);
        }

        // ---- گشتی سەردانەکان ----
        const totalVisitsRaw  = await env.STATS_DB.get("meta:total_visits");
        const totalTextareaRaw = await env.STATS_DB.get("meta:total_textarea");
        const totalVisits   = parseInt(totalVisitsRaw  || "0");
        const totalTextarea = parseInt(totalTextareaRaw || "0");

        // ---- سەردانەکانی ٧ رۆژی ڕابردوو ----
        const sessions = [];
        for (let i = 0; i < 7; i++) {
            const d   = new Date();
            d.setDate(d.getDate() - i);
            const key = "visits:" + d.toISOString().slice(0, 10);
            const raw = await env.STATS_DB.get(key);
            if (raw) {
                const dayData = JSON.parse(raw);
                sessions.push(...dayData);
            }
        }
        // نوێترین ٥٠ سەردان
        const recentSessions = sessions
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 50);

        // ---- Textarea ئەمرۆ ----
        const txKey  = "textarea:" + todayStr();
        const txRaw  = await env.STATS_DB.get(txKey);
        const textareaToday = txRaw ? JSON.parse(txRaw) : [];

        // ---- ئەرشیفەکان (لیست) ----
        const archiveListRaw = await env.STATS_DB.get("meta:archive_list");
        const archiveList    = archiveListRaw ? JSON.parse(archiveListRaw) : [];

        return new Response(JSON.stringify({
            clicks,
            totalVisits,
            totalTextarea,
            recentSessions,
            textareaToday,
            archiveList
        }), { status: 200, headers: corsHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: corsHeaders
        });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}