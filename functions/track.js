export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    try {
        const data = await request.json();
        const label = data.label;

        if (!label) {
            return new Response(JSON.stringify({ error: "Label کەمە" }), { status: 400, headers: corsHeaders });
        }

        // زیادکردنی ژمارەی کلیک لەناو KV
        const currentCount = await env.STATS_DB.get(label);
        const newCount = parseInt(currentCount || "0") + 1;

        // پاشەکەوتکردنەوە
        await env.STATS_DB.put(label, newCount.toString());

        return new Response(JSON.stringify({ success: true, label: label, count: newCount }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}

// بۆ پرسیارەکانی OPTIONS (browser preflight)
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
