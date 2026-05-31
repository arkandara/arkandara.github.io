// ============================================================
//  functions/sitemap.xml.js — Cloudflare Pages Function
//  GET /sitemap.xml → سایت‌ماپ بە بەرواری نوێ لە KV
// ============================================================

export async function onRequestGet(context) {
    const { env } = context;

    // بەرواری lastmod لە KV بخوێنەوە
    let lastmod = new Date().toISOString().slice(0, 10); // بنەڕەتی: ئەمڕۆ
    try {
        const settingsRaw = await env.STATS_DB.get("settings:site");
        if (settingsRaw) {
            const settings = JSON.parse(settingsRaw);
            if (settings.sitemapLastmod && /^\d{4}-\d{2}-\d{2}$/.test(settings.sitemapLastmod)) {
                lastmod = settings.sitemapLastmod;
            }
        }
    } catch (e) {
        // ئەگەر هەڵە هەبوو، بەرواری ئەمڕۆ بەکاردێت
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://arkandara.pages.dev/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(xml, {
        status: 200,
        headers: {
            "Content-Type": "application/xml; charset=UTF-8",
            "Cache-Control": "public, max-age=3600"
        }
    });
}
