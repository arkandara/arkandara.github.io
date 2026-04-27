export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const data = await request.json();
        const label = data.label;

        if (!label) {
            return new Response("Label کەمە", { status: 400 });
        }

        // ١. زیادکردنی ژمارەی سەردان یان کلیک لەناو KV
        // لێرەدا کلیلەکە ناوی ئەو دوگمەیەیە کە کلیکی لێکراوە
        const currentCount = await env.STATS_DB.get(label) || 0;
        const newCount = parseInt(currentCount) + 1;
        
        // ٢. پاشەکەوتکردنەوەی ژمارە نوێیەکە
        await env.STATS_DB.put(label, newCount.toString());

        return new Response(JSON.stringify({ success: true, count: newCount }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response("هەڵە لە سێرڤەر: " + err.message, { status: 500 });
    }
}
