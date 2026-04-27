// ============================================================
//  functions/track.js  — Cloudflare Pages Function
//  تۆمارکردنی: کلیک، سەردان، داتای Textarea — لە Cloudflare KV
// ============================================================

export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    try {
        const body = await request.json();
        const type = body.type || "click"; // "click" | "visit" | "textarea"

        // ---- ١: تۆمارکردنی کلیک ----
        if (type === "click") {
            const label = body.label;
            if (!label) {
                return json({ error: "label پێویستە" }, 400, corsHeaders);
            }

            const key = "click:" + label;
            const current = await env.STATS_DB.get(key);
            const newCount = parseInt(current || "0") + 1;
            await env.STATS_DB.put(key, String(newCount));

            // تۆمارکردن لە لیستی کلیکەکانیش
            const allClicksRaw = await env.STATS_DB.get("meta:clicks_list");
            let allClicks = allClicksRaw ? JSON.parse(allClicksRaw) : [];
            if (!allClicks.includes(label)) {
                allClicks.push(label);
                await env.STATS_DB.put("meta:clicks_list", JSON.stringify(allClicks));
            }

            return json({ success: true, label, count: newCount }, 200, corsHeaders);
        }

        // ---- ٢: تۆمارکردنی سەردان ----
        if (type === "visit") {
            const session = {
                time:    new Date().toISOString(),
                city:    body.city    || "---",
                country: body.country || "---",
                region:  body.region  || "",
                ip:      body.ip      || "",
                device:  body.device  || "نەناسراو"
            };

            // ژمارەی گشتی سەردانەکان
            const totalRaw = await env.STATS_DB.get("meta:total_visits");
            const newTotal = parseInt(totalRaw || "0") + 1;
            await env.STATS_DB.put("meta:total_visits", String(newTotal));

            // پاشەکەوتکردنی سەردانی ئەمرۆ (لیست)
            const todayKey = "visits:" + todayStr();
            const todayRaw = await env.STATS_DB.get(todayKey);
            let todaySessions = todayRaw ? JSON.parse(todayRaw) : [];
            todaySessions.push(session);
            // زیاتر لە ٥٠٠ نەپاشەکەوت بکە
            if (todaySessions.length > 500) todaySessions = todaySessions.slice(-500);
            await env.STATS_DB.put(todayKey, JSON.stringify(todaySessions), { expirationTtl: 60 * 60 * 24 * 8 }); // 8 رۆژ

            return json({ success: true, total: newTotal }, 200, corsHeaders);
        }

        // ---- ٣: تۆمارکردنی Textarea (دەقی نووسراو) ----
        if (type === "textarea") {
            const text = body.text;
            if (!text || text.trim().length < 3) {
                return json({ error: "دەقەکە زۆر کورتە" }, 400, corsHeaders);
            }

            const event = {
                time:   new Date().toISOString(),
                length: text.length,
                preview: text.substring(0, 120) // تەنها ١٢٠ پیتی یەکەم
            };

            const key = "textarea:" + todayStr();
            const raw = await env.STATS_DB.get(key);
            let events = raw ? JSON.parse(raw) : [];
            events.push(event);
            if (events.length > 200) events = events.slice(-200);
            await env.STATS_DB.put(key, JSON.stringify(events), { expirationTtl: 60 * 60 * 24 * 8 });

            // ژمارەی گشتی جارەکانی نووسین
            const totalTxRaw = await env.STATS_DB.get("meta:total_textarea");
            const newTotalTx = parseInt(totalTxRaw || "0") + 1;
            await env.STATS_DB.put("meta:total_textarea", String(newTotalTx));

            return json({ success: true }, 200, corsHeaders);
        }

        return json({ error: "جۆری داواکارییەکە نادروستە" }, 400, corsHeaders);

    } catch (err) {
        return json({ error: err.message }, 500, corsHeaders);
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

// ---- یارمەتیدەرەکان ----
function todayStr() {
    return new Date().toISOString().slice(0, 10); // "2025-06-15"
}

function json(data, status, headers) {
    return new Response(JSON.stringify(data), { status, headers });
}
