// ============================================================
//  migrate_to_current.js
//  یەک جار بەکاردێت بۆ گواستنەوەی هەموو فایلە رۆژانەکان
//  بۆ ناو archives/daily_current.json
//  ئینجا فایلە کۆنەکان دەسرێنەوە
// ============================================================
const fs   = require("fs");
const path = require("path");

const archDir    = "archives";
const currentPath = path.join(archDir, "daily_current.json");

// خوێندنەوەی هەموو فایلە رۆژانەکان
const files = fs.readdirSync(archDir)
    .filter(f => /^daily_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

if (!files.length) {
    console.log("هیچ فایلی رۆژانەیەک نەدۆزراوەتەوە");
    process.exit(0);
}

console.log("فایل دۆزراوەتەوە:", files.length);

const days = [];
for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(archDir, f), "utf8"));
    days.push({
        date:         d.date        || "",
        generatedAt:  d.generatedAt || "",
        totalVisits:  d.totalVisits  || 0,
        totalClicks:  d.totalClicks  || 0,
        totalTextarea:d.totalTextarea|| 0,
        clicks:       d.clicks       || {},
        deviceStats:  d.deviceStats  || {},
        cityStats:    d.cityStats    || {},
    });
    console.log("✅", d.date, "— سەردان:", d.totalVisits);
}

// دروستکردنی daily_current.json
const current = {
    type:        "daily_current",
    month:       days[0].date.slice(0, 7),
    updatedAt:   new Date().toISOString(),
    days:        days
};

fs.writeFileSync(currentPath, JSON.stringify(current, null, 2), "utf8");
console.log("\n✅ daily_current.json دروست کرا —", days.length, "رۆژ");

// سرینەوەی فایلە کۆنەکان
for (const f of files) {
    fs.unlinkSync(path.join(archDir, f));
    console.log("🗑️ سرا:", f);
}

console.log("\n✅ تەواو بوو. ئێستا تەنها archives/daily_current.json هەیە.");
