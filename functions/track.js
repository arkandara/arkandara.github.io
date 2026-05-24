// ============================================================
//  functions/track.js  — Cloudflare Pages Function
//  POST /track  → کلیک + snapshot تێکست، سەردان، Textarea
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
    const { env, request } = context;
    try {
        const url  = new URL(request.url);
        const full = url.searchParams.get("full") === "1";

        // کلیکەکان
        const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
        const clickLabels   = safeJson(clicksListRaw, []);
        const clicks = {};
        for (const label of clickLabels) {
            const val = await env.STATS_DB.get("click:" + label);
            if (val) clicks[label] = parseInt(val) || 0;
        }

        // گشتی
        const totalVisits   = parseInt(await env.STATS_DB.get("meta:total_visits")   || "0");
        const totalTextarea = parseInt(await env.STATS_DB.get("meta:total_textarea") || "0");

        // ئەرشیفەکان
        const archiveListRaw = await env.STATS_DB.get("meta:archive_list");
        const archiveList    = safeJson(archiveListRaw, []);

        // preview
        const previewRaw = await env.STATS_DB.get("preview:latest");
        const preview    = safeJson(previewRaw, null);

        // ڕێکخستنەکانی سایت
        const settingsRaw = await env.STATS_DB.get("settings:site");
        const settings    = safeJson(settingsRaw, null);

        // قەبارەی ڕاستی KV — هەر کی دەخوێنێتەوە و بایتەکانی دەژمێرێت
        const kvKeys   = await env.STATS_DB.list({ limit: 1000 });
        const keyCount = kvKeys.keys.length;
        const enc      = new TextEncoder();
        let totalBytes = 0;
        for (const k of kvKeys.keys) {
            const val = await env.STATS_DB.get(k.name);
            if (val) totalBytes += enc.encode(val).length;
        }
        const maxBytes = 1024 * 1024 * 1024; // 1 GB
        const usedMB   = (totalBytes / (1024 * 1024)).toFixed(3);
        const maxMB    = (maxBytes   / (1024 * 1024)).toFixed(0);
        const percent  = ((totalBytes / maxBytes) * 100).toFixed(2);
        const kvUsage  = { keyCount, usedMB, maxMB, percent };

        // ---- داتای قەبارەدار — تەنها کاتی ?full=1 ----
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
        return ok({ clicks, totalVisits, totalTextarea, recentSessions, snapshots, textareaToday, archiveList, preview, settings, kvUsage, forceReload });

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

        // ---- کلیک + snapshot تێکست ----
        if (type === "click") {
            const label = (body.label || "").trim();
            if (!label) return bad("label پێویستە");

            // ژمارەی کلیک
            const key     = "click:" + label;
            const current = parseInt(await env.STATS_DB.get(key) || "0");
            await env.STATS_DB.put(key, String(current + 1));

            // لیستی لەیبڵەکان
            const listRaw = await env.STATS_DB.get("meta:clicks_list");
            const list    = safeJson(listRaw, []);
            if (!list.includes(label)) {
                list.push(label);
                await env.STATS_DB.put("meta:clicks_list", JSON.stringify(list));
            }

            // پاشەکەوتی تێکست لە snapshot
            const text = (body.text || "").trim();
            if (text.length > 0) {
                const snapKey = "snapshots:" + isoDate(new Date());
                const snaps   = safeJson(await env.STATS_DB.get(snapKey), []);
                snaps.push({ time: new Date().toISOString(), label: label, text: text });
                if (snaps.length > 200) snaps.splice(0, snaps.length - 200);
                await env.STATS_DB.put(snapKey, JSON.stringify(snaps), { expirationTtl: 691200 });
            }

            return ok({ success: true, label, count: current + 1 });
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
            return ok({ success: true, total: tot + 1 });
        }

        // ---- Textarea (دوای ٣ چرکەی راوەستان) ----
        if (type === "textarea") {
            const text = (body.text || "").trim();
            if (text.length < 1) return bad("دەقەکە بۆشایە");
            const method = (body.method || '').trim();
            const event  = { time: new Date().toISOString(), length: text.length, text: text, method: method };
            const key    = "textarea:" + isoDate(new Date());
            const events = safeJson(await env.STATS_DB.get(key), []);
            events.push(event);
            if (events.length > 200) events.splice(0, events.length - 200);
            await env.STATS_DB.put(key, JSON.stringify(events), { expirationTtl: 691200 });
            const tot = parseInt(await env.STATS_DB.get("meta:total_textarea") || "0");
            await env.STATS_DB.put("meta:total_textarea", String(tot + 1));
            return ok({ success: true });
        }

        // ---- preview (دەقی نێردراو لە سایت) ----
        if (type === "preview") {
            const text = (body.text || "").trim();
            if (!text) return bad("دەق بۆشایە");
            const preview = {
                time: body.time || new Date().toISOString(),
                text: text,
                length: text.length
            };
            await env.STATS_DB.put("preview:latest", JSON.stringify(preview));
            return ok({ success: true });
        }

        // ---- ڕێکخستنەکانی سایت ----
        if (type === "settings") {
            const allowed = ["siteName","siteAuthor","siteTitle","siteDesc","primaryColor","bismillahText","bismillahSub","updateText","rssSources","toolbarBtns"];
            const settings = {};
            allowed.forEach(k => { if (body[k] !== undefined) settings[k] = body[k]; });
            await env.STATS_DB.put("settings:site", JSON.stringify(settings));
            return ok({ success: true });
        }

        // ---- settings (ڕێکخستنەکانی سایت لە ئەدمین) ----
        if (type === "settings") {
            const allowed = ["siteName","siteAuthor","siteTitle","siteDesc",
                             "primaryColor","bismillahText","bismillahSub","updateText",
                             "rssSources","toolbarBtns"];
            const data = {};
            allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
            if (!Object.keys(data).length) return bad("داتا بۆشایە");
            // merge لەگەڵ ئەوەی کە هەیە
            const existing = safeJson(await env.STATS_DB.get("settings:site"), {});
            const merged   = Object.assign({}, existing, data);
            await env.STATS_DB.put("settings:site", JSON.stringify(merged));
            return ok({ success: true });
        }

        // ---- snapshots_replace (سڕینەوەی هەڵبژێردراو) ----
        if (type === "snapshots_replace") {
            const snaps = body.snaps || [];
            const dayKey = "snapshots:" + isoDate(new Date());
            await env.STATS_DB.put(dayKey, JSON.stringify(snaps), { expirationTtl: 691200 });
            return ok({ success: true, count: snaps.length });
        }

        // ---- force_reload (ریفرێشکردنی سایت) ----
        if (type === "force_reload") {
            await env.STATS_DB.put("meta:force_reload", new Date().toISOString(), { expirationTtl: 300 });
            return ok({ success: true });
        }

        // ---- daily_clear (سفرکردنەوەی ئامارەکان) ----
        if (type === "daily_clear") {
            const secret = body.secret || "";
            if (secret !== (env.CLEAR_SECRET || "clear_daily_2024")) {
                return bad("مجاز نییە");
            }
            const today = isoDate(new Date());
            // سڕینەوەی ئەمرۆ
            await env.STATS_DB.delete("snapshots:" + today);
            await env.STATS_DB.delete("textarea:"  + today);
            await env.STATS_DB.delete("visits:"    + today);
            // ڕیسێتی ژمارەی سەردانەکان
            await env.STATS_DB.put("meta:total_visits",   "0");
            await env.STATS_DB.put("meta:total_textarea", "0");
            // کلیکەکان
            const clicksListRaw = await env.STATS_DB.get("meta:clicks_list");
            const clickLabels   = safeJson(clicksListRaw, []);
            for (const label of clickLabels) {
                await env.STATS_DB.delete("click:" + label);
            }
            await env.STATS_DB.delete("meta:clicks_list");
            return ok({ success: true, cleared: today });
        }

        // ---- خوێندنەوەی hash ی پاسۆرد ----
        if (type === "admin_pass_get") {
            const hash = await env.STATS_DB.get("settings:admin_pass_hash");
            return ok({ hash: hash || null });
        }

        // ---- گۆڕینی hash ی پاسۆرد ----
        if (type === "admin_pass_set") {
            const oldHash = body.oldHash || "";
            const newHash = body.newHash || "";
            if (!newHash || newHash.length !== 64) return bad("hash نادروستە");
            // پشکنینی hash ی کۆن
            const savedHash = await env.STATS_DB.get("settings:admin_pass_hash");
            const DEFAULT_HASH = "95a5d03a1cbc38f0a1cf2dd9d60faa4ac996524b27cfec444e1172107df32bfb";
            const expected = savedHash || DEFAULT_HASH;
            if (oldHash !== expected) return bad("پاسۆردی ئێستا هەڵەیە");
            await env.STATS_DB.put("settings:admin_pass_hash", newHash);
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
