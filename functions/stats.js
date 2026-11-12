// ============================================================
//  functions/stats.js  — Cloudflare Pages Function
//  GET /stats  → خوێندنەوەی ئامارەکان (بۆ ئەدمین تەنها)
// ============================================================

const ALLOWED_ORIGIN = "https://arkandara.github.io";
import { isAdminRequest } from "./track.js";

function corsHeaders(origin) {
    const allowed = [ALLOWED_ORIGIN, "https://arkandara.pages.dev"].includes(origin) ? origin : "null";
    return {
        "Access-Control-Allow-Origin":  allowed,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Request",
        "Content-Type":                 "application/json; charset=utf-8",
        "Cache-Control":                "no-store",
        "X-Content-Type-Options":        "nosniff",
        "Vary":                         "Origin, Authorization"
    };
}

export async function onRequestGet(context) {
    const { env, request } = context;
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;
    const CORS = corsHeaders(origin);

    if (!await isAdminRequest(request, env)) {
        return new Response(JSON.stringify({ error: "مجاز نییە" }), { status: 401, headers: CORS });
    }

    try {
        const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
        const clickLabels   = clicksListRaw ? JSON.parse(clicksListRaw) : [];
        if (!Array.isArray(clickLabels)) throw new Error("Invalid click registry");
        const clickValues = await Promise.all(clickLabels.map(label => env.STATS_DB.get("click:" + label)));
        const clicks = {};
        clickLabels.forEach((label, i) => {
            const raw = clickValues[i];
            if (raw !== null) {
                const value = Number(raw);
                if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid click counter");
                clicks[label] = value;
            }
        });

        const [visitsRaw, textareaCountRaw] = await Promise.all([
            env.STATS_DB.get("meta:total_visits"),
            env.STATS_DB.get("meta:total_textarea")
        ]);
        const totalVisits = Number(visitsRaw || "0");
        const totalTextarea = Number(textareaCountRaw || "0");
        if (![totalVisits, totalTextarea].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("Invalid totals");

        const now = new Date();
        const sessionKeys = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now);
            d.setUTCDate(d.getUTCDate() - i);
            return "visits:" + d.toISOString().slice(0, 10);
        });
        const sessionValues = await Promise.all(sessionKeys.map(key => env.STATS_DB.get(key)));
        const sessions = [];
        for (const raw of sessionValues) {
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error("Invalid sessions");
            sessions.push(...parsed);
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
        return new Response(JSON.stringify({ error: "stats_unavailable" }), { status: 500, headers: CORS });
    }
}

export async function onRequestOptions(context) {
    const origin = context.request.headers.get("Origin") || ALLOWED_ORIGIN;
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
