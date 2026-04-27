// ============================================================
//  functions/track.js  — Cloudflare Pages Function
//  POST /track  → تۆمارکردنی کلیک، سەردان، Textarea
//  GET  /track  → خوێندنەوەی هەموو ئامارەکان (بۆ ئەدمین)
// ============================================================

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json"
};

// ---- GET: خوێندنەوەی ئامارەکان ----
export async function onRequestGet(context) {
    const { env } = context;
    try {
        const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
        const clickLabels   = safeJson(clicksListRaw, []);
        const clicks = {};
        for (const label of clickLabels) {
            const val = await env.STATS_DB.get("click:" + label);
            if (val) clicks[label] = parseInt(val) || 0;
        }

        const totalVisits   = parseInt(await env.STATS_DB.get("meta:total_visits")   || "0");
        const totalTextarea = parseInt(await env.STATS_DB.get("meta:total_textarea") || "0");

        const sessions = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const raw = await env.STATS_DB.get("visits:" + isoDate(d));
            sessions.push(...safeJson(raw, []));
        }
        const recentSessions = sessions
            .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
            .slice(0, 50);

        const txRaw = await env.STATS_DB.get("textarea:" + isoDate(new Date()));
        const textareaToday = safeJson(txRaw, []);

        const archiveListRaw = await env.STATS_DB.get("meta:archive_list");
        const archiveList    = safeJson(archiveListRaw, []);

        return ok({ clicks, totalVisits, totalTextarea, recentSessions, textareaToday, archiveList });

    } catch (err) {
        return err500(err);
    }
}

// ---- POST: تۆمارکردن ----
export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const body = await request.json();
        const type = body.type || "click";

        if (type === "click") {
            const label = (body.label || "").trim();
            if (!label) return bad("label پێویستە");
            const key     = "click:" + label;
            const current = parseInt(await env.STATS_DB.get(key) || "0");
            await env.STATS_DB.put(key, String(current + 1));
            const listRaw = await env.STATS_DB.get("meta:clicks_list");
            const list    = safeJson(listRaw, []);
            if (!list.includes(label)) {
                list.push(label);
                await env.STATS_DB.put("meta:clicks_list", JSON.stringify(list));
            }
            return ok({ success: true, label, count: current + 1 });
        }

        if (type === "visit") {
            const session = {
                time:    new Date().toISOString(),
                city:    body.city    || "---",
                country: body.country || "---",
                region:  body.region  || "",
                ip:      body.ip      || "",
                device:  body.device  || "نەناسراو"
            };
            const tot = parseInt(await env.STATS_DB.get("meta:total_visits") || "0");
            await env.STATS_DB.put("meta:total_visits", String(tot + 1));
            const dayKey = "visits:" + isoDate(new Date());
            const daySes = safeJson(await env.STATS_DB.get(dayKey), []);
            daySes.push(session);
            if (daySes.length > 500) daySes.splice(0, daySes.length - 500);
            await env.STATS_DB.put(dayKey, JSON.stringify(daySes), { expirationTtl: 691200 });
            return ok({ success: true, total: tot + 1 });
        }

        if (type === "textarea") {
            const text = (body.text || "").trim();
            if (text.length < 3) return bad("دەقەکە زۆر کورتە");
            const event  = { time: new Date().toISOString(), length: text.length, preview: text.substring(0, 120) };
            const key    = "textarea:" + isoDate(new Date());
            const events = safeJson(await env.STATS_DB.get(key), []);
            events.push(event);
            if (events.length > 200) events.splice(0, events.length - 200);
            await env.STATS_DB.put(key, JSON.stringify(events), { expirationTtl: 691200 });
            const tot = parseInt(await env.STATS_DB.get("meta:total_textarea") || "0");
            await env.STATS_DB.put("meta:total_textarea", String(tot + 1));
            return ok({ success: true });
        }

        return bad("جۆری نادروست");

    } catch (err) {
        return err500(err);
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS });
}

function isoDate(d) { return d.toISOString().slice(0, 10); }
function safeJson(raw, def) { try { return raw ? JSON.parse(raw) : def; } catch(e) { return def; } }
function ok(data)  { return new Response(JSON.stringify(data),                 { status: 200, headers: CORS }); }
function bad(msg)  { return new Response(JSON.stringify({ error: msg }),       { status: 400, headers: CORS }); }
function err500(e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS }); }
