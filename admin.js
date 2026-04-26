// ===========================
//  ئەدمین پانێل — JavaScript
//  سەکۆی ڕۆژنامەنووس
// ===========================

// ---- تێکۆشانی ئەدمین بۆ ناوی بەکارهێنەر و پاسوۆرد ----
// پاسوۆردەکە بە SHA-256 hash کراوە بۆ ئەمنیەت
// گۆڕینی پاسوۆرد لە تابی "گۆڕینی پاسوۆرد" دەکرێت

const ADMIN_USERNAME = "admin";
// هاش SHA-256 ی "arkandara2024" — دەتوانی لە تابی پاسوۆرد بیگۆڕیت
let ADMIN_PASS_HASH = localStorage.getItem("adminPassHash") || "a7b3c9d2e8f1042a6e5d4c3b2a1908f7e6d5c4b3a2910847f6e5d4c3b2a19087";

// ---- SHA-256 هاش بەرفرەهکراو ----
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- لۆگین ----
async function doLogin() {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value;
    const errEl = document.getElementById("loginError");

    if (!user || !pass) {
        errEl.style.display = "flex";
        errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> تکایە هەموو خانەکان پڕ بکەرەوە';
        return;
    }

    const passHash = await sha256(pass);

    if (user === ADMIN_USERNAME && passHash === ADMIN_PASS_HASH) {
        sessionStorage.setItem("adminAuth", "1");
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";
        initPanel();
    } else {
        errEl.style.display = "flex";
        errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ناو یان پاسوۆرد هەڵەیە';
        document.getElementById("loginPass").value = "";
    }
}

// ---- دەرچوون ----
function doLogout() {
    sessionStorage.removeItem("adminAuth");
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginUser").value = "";
    document.getElementById("loginPass").value = "";
}

// ---- پشاندانی چاوی پاسوۆرد ----
function togglePass() {
    const inp = document.getElementById("loginPass");
    const btn = document.getElementById("eyeBtn").querySelector("i");
    if (inp.type === "password") {
        inp.type = "text";
        btn.className = "fas fa-eye-slash";
    } else {
        inp.type = "password";
        btn.className = "fas fa-eye";
    }
}

// ---- پشاندانی تاب ----
const tabTitles = {
    "tab-site": "زانیاری سایت",
    "tab-news": "سەرچاوەی هەواڵ",
    "tab-buttons": "دوگمەکانی تووڵبار",
    "tab-stats": "ئامارەکان",
    "tab-password": "گۆڕینی پاسوۆرد"
};

function showTab(id) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.getElementById("nav-" + id.replace("tab-", "")).classList.add("active");
    document.getElementById("pageTitle").textContent = tabTitles[id] || "";

    // داخستنی سایدبار لە موبایل
    if (window.innerWidth <= 700) {
        document.getElementById("sidebar").classList.remove("open");
    }
}

// ---- تۆگڵی سایدبار ----
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

// ---- دەستپێکردنی پانێل ----
function initPanel() {
    loadSiteInfo();
    loadRssSources();
    loadButtons();
    loadStats();

    // ئایکۆنی ڕەنگ
    const colorInput = document.getElementById("primaryColor");
    colorInput.addEventListener("input", () => {
        document.getElementById("primaryHex").textContent = colorInput.value;
    });
}

// ===========================
//  تاب ١ — زانیاری سایت
// ===========================

// داتای پێشکەوتووی سایت — ئەمانە دەیانخوێنێتەوە لە localStorage یان ئێستا لە index.html
const SITE_DEFAULTS = {
    siteName: "سه‌كۆی ڕۆژنامه‌نووس",
    siteAuthor: "Arkan Dara",
    siteTitle: "سه‌كۆی ڕۆژنامه‌نووس",
    siteDesc: "گۆڕینی فۆنتی عەلی بۆ یونیکۆد (Ali K to Unicode), سه‌كۆی ڕۆژنامه‌نووس",
    primaryColor: "#2e7d32",
    bismillahText: "بِسْمِ اللَّهِ",
    bismillahSub: "سه‌كۆی ڕۆژنامه‌نووس"
};

function loadSiteInfo() {
    const saved = JSON.parse(localStorage.getItem("siteInfo") || "{}");
    const data = { ...SITE_DEFAULTS, ...saved };

    document.getElementById("siteName").value = data.siteName;
    document.getElementById("siteAuthor").value = data.siteAuthor;
    document.getElementById("siteTitle").value = data.siteTitle;
    document.getElementById("siteDesc").value = data.siteDesc;
    document.getElementById("primaryColor").value = data.primaryColor;
    document.getElementById("primaryHex").textContent = data.primaryColor;
    document.getElementById("bismillahText").value = data.bismillahText;
    document.getElementById("bismillahSub").value = data.bismillahSub;
}

function saveSiteInfo() {
    const data = {
        siteName: document.getElementById("siteName").value.trim(),
        siteAuthor: document.getElementById("siteAuthor").value.trim(),
        siteTitle: document.getElementById("siteTitle").value.trim(),
        siteDesc: document.getElementById("siteDesc").value.trim(),
        primaryColor: document.getElementById("primaryColor").value,
        bismillahText: document.getElementById("bismillahText").value.trim(),
        bismillahSub: document.getElementById("bismillahSub").value.trim(),
    };

    localStorage.setItem("siteInfo", JSON.stringify(data));
    showToast("✅ زانیاری سایت پاشەکەوت کرا! — پێویستە فایلی index.html بەدەستی دەستکاری بکەیت بۆ گۆڕانکاری جێگیر");
}

// ===========================
//  تاب ٢ — RSS سەرچاوەکان
// ===========================

const RSS_DEFAULTS = [
    { name: 'الجزيرة', url: 'https://www.aljazeera.net/rss' },
    { name: 'سكاى نيوز', url: 'https://www.skynewsarabia.com/rss' },
    { name: 'العراقية', url: 'https://news.google.com/rss/search?q=وكالة+الأنباء+العراقية+INA&hl=ar&gl=IQ&ceid=IQ:ar&tbs=qdr:h' },
    { name: 'روسیا الیوم', url: 'https://arabic.rt.com/rss/' },
    { name: 'عربي جديد', url: 'https://www.alaraby.co.uk/rss' }
];

function loadRssSources() {
    const saved = JSON.parse(localStorage.getItem("rssSources") || "null");
    const sources = saved || RSS_DEFAULTS;
    const list = document.getElementById("rssList");
    list.innerHTML = "";
    sources.forEach((s, i) => addRssRow(s.name, s.url));
}

function addRssRow(name = "", url = "") {
    const list = document.getElementById("rssList");
    const row = document.createElement("div");
    row.className = "rss-row";
    row.innerHTML = `
        <input type="text" placeholder="ناوی سەرچاوە" value="${escHtml(name)}" class="rss-name">
        <input type="url" placeholder="ئادرەسی RSS" value="${escHtml(url)}" class="url-input rss-url" dir="ltr">
        <button class="del-btn" onclick="this.closest('.rss-row').remove()" title="سڕینەوە">
            <i class="fas fa-trash"></i>
        </button>
    `;
    list.appendChild(row);
}

function saveRss() {
    const rows = document.querySelectorAll(".rss-row");
    const sources = [];
    let valid = true;
    rows.forEach(row => {
        const name = row.querySelector(".rss-name").value.trim();
        const url = row.querySelector(".rss-url").value.trim();
        if (name && url) sources.push({ name, url });
        else if (name || url) valid = false;
    });

    if (!valid) {
        showToast("⚠️ تکایە هەموو خانەکانی ناو و ئادرەس پڕ بکەرەوە", true);
        return;
    }

    localStorage.setItem("rssSources", JSON.stringify(sources));
    showToast("✅ سەرچاوەکانی هەواڵ پاشەکەوت کران!");
    generateCode();
}

// ===========================
//  تاب ٣ — دوگمەکانی تووڵبار
// ===========================

const BTN_DEFAULTS = [
    { label: "سڕینه‌وه‌ی‌ بۆشایی دێڕه‌كان", color: "#ff9800", action: "removeEmptyLines()" },
    { label: "گەڕان و گۆڕینی وشه‌ 🔍", color: "#e91e63", action: "toggleFindReplace()" },
    { label: "هێنانی Word", color: "#607d8b", action: "document.getElementById('fileInput').click()" },
    { label: "تێكستی ناو وێنه 🖼️", color: "#808080", action: "triggerOcrInput()" },
    { label: "داگرتنی ڤیدیۆ", color: "#1a73e8", action: "toggleDlModal()" }
];

function loadButtons() {
    const saved = JSON.parse(localStorage.getItem("toolbarBtns") || "null");
    const btns = saved || BTN_DEFAULTS;
    const list = document.getElementById("btnList");
    list.innerHTML = "";
    btns.forEach(b => addBtnRow(b.label, b.color, b.action));
}

function addBtnRow(label = "", color = "#2e7d32", action = "") {
    const list = document.getElementById("btnList");
    const row = document.createElement("div");
    row.className = "btn-row";
    row.innerHTML = `
        <input type="color" class="btn-color-preview" value="${escHtml(color)}" title="ڕەنگ">
        <input type="text" placeholder="تێکستی دوگمە" value="${escHtml(label)}" class="btn-label">
        <input type="text" placeholder="فەنکشن (onclick)" value="${escHtml(action)}" class="btn-action" dir="ltr" style="font-family:monospace;font-size:0.82em;">
        <button class="del-btn" onclick="this.closest('.btn-row').remove()" title="سڕینەوە">
            <i class="fas fa-trash"></i>
        </button>
    `;
    list.appendChild(row);
}

function saveButtons() {
    const rows = document.querySelectorAll(".btn-row");
    const btns = [];
    rows.forEach(row => {
        const label = row.querySelector(".btn-label").value.trim();
        const color = row.querySelector(".btn-color-preview").value;
        const action = row.querySelector(".btn-action").value.trim();
        if (label) btns.push({ label, color, action });
    });

    localStorage.setItem("toolbarBtns", JSON.stringify(btns));
    showToast("✅ دوگمەکانی تووڵبار پاشەکەوت کران!");
    generateCode();
}

// ===========================
//  تاب ٤ — گۆڕینی پاسوۆرد
// ===========================

async function changePassword() {
    const oldPass = document.getElementById("oldPass").value;
    const newPass = document.getElementById("newPass").value;
    const confirmPass = document.getElementById("confirmPass").value;
    const msgEl = document.getElementById("passMsg");

    const oldHash = await sha256(oldPass);

    if (oldHash !== ADMIN_PASS_HASH) {
        msgEl.className = "pass-error";
        msgEl.innerHTML = '<i class="fas fa-times-circle"></i> پاسوۆردی ئێستا هەڵەیە';
        msgEl.style.display = "block";
        return;
    }

    if (newPass.length < 6) {
        msgEl.className = "pass-error";
        msgEl.innerHTML = '<i class="fas fa-times-circle"></i> پاسوۆردی نوێ دەبێت لانیکەم ٦ پیت بێت';
        msgEl.style.display = "block";
        return;
    }

    if (newPass !== confirmPass) {
        msgEl.className = "pass-error";
        msgEl.innerHTML = '<i class="fas fa-times-circle"></i> پاسوۆردەکان یەکسان نین';
        msgEl.style.display = "block";
        return;
    }

    const newHash = await sha256(newPass);
    ADMIN_PASS_HASH = newHash;
    localStorage.setItem("adminPassHash", newHash);

    msgEl.className = "pass-success";
    msgEl.innerHTML = '<i class="fas fa-check-circle"></i> پاسوۆرد بە سەرکەوتوویی گۆڕدرا!';
    msgEl.style.display = "block";

    document.getElementById("oldPass").value = "";
    document.getElementById("newPass").value = "";
    document.getElementById("confirmPass").value = "";

    showToast("✅ پاسوۆرد گۆڕدرا!");
}

// ===========================
//  یارمەتیدەرەکان
// ===========================

function showToast(msg, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = "toast" + (isError ? " error" : "");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ===========================
//  تاب ٤ — ئامارەکان
// ===========================

const AK_KEY = "ak_stats";

function akLoad() {
    try { return JSON.parse(localStorage.getItem(AK_KEY) || "null") || { clicks: {}, sessions: [], textEvents: [] }; }
    catch { return { clicks: {}, sessions: [], textEvents: [] }; }
}

function loadStats() {
    const data = akLoad();

    // ژمارەی گشتی
    const totalClicks = Object.values(data.clicks).reduce((s, v) => s + v.count, 0);
    const totalSessions = data.sessions.length;
    const totalTextSaves = data.textEvents.length;
    const avgWords = totalTextSaves
        ? Math.round(data.textEvents.reduce((s, e) => s + e.words, 0) / totalTextSaves)
        : 0;

    document.getElementById("statsTopGrid").innerHTML = `
        <div class="stat-card"><div class="stat-num">${totalClicks}</div><div class="stat-lbl"><i class="fas fa-mouse-pointer"></i> گشتی کلیکەکان</div></div>
        <div class="stat-card"><div class="stat-num">${totalSessions}</div><div class="stat-lbl"><i class="fas fa-globe"></i> سەردانەکان</div></div>
        <div class="stat-card"><div class="stat-num">${totalTextSaves}</div><div class="stat-lbl"><i class="fas fa-keyboard"></i> جار تێکست نووسراوە</div></div>
        <div class="stat-card"><div class="stat-num">${avgWords}</div><div class="stat-lbl"><i class="fas fa-align-left"></i> ناوەندی وشەکان</div></div>
    `;

    // چارتی کلیکەکان
    const clicks = data.clicks;
    const sorted = Object.entries(clicks).sort((a, b) => b[1].count - a[1].count);
    const maxCount = sorted.length ? sorted[0][1].count : 1;

    const chartEl = document.getElementById("clickChart");
    if (!sorted.length) {
        chartEl.innerHTML = `<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا داتایەک نییە — سایتەکە بکەرەوە و دوگمەکان کلیک بکە</div>`;
    } else {
        chartEl.innerHTML = sorted.map(([name, val]) => {
            const pct = Math.round((val.count / maxCount) * 100);
            const last = val.last ? new Date(val.last).toLocaleString("ku") : "-";
            return `
            <div class="bar-row">
                <div class="bar-label">${escHtml(name)}</div>
                <div class="bar-wrap">
                    <div class="bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="bar-count">${val.count}</div>
                <div class="bar-last">${last}</div>
            </div>`;
        }).join("");
    }

    // تێکستی داخڵکراو
    const txtEl = document.getElementById("textStats");
    if (!data.textEvents.length) {
        txtEl.innerHTML = `<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا تێکستێک داخڵ نەکراوە</div>`;
    } else {
        const last5 = [...data.textEvents].reverse().slice(0, 5);
        txtEl.innerHTML = `
        <table class="stats-table">
            <thead><tr><th>کات</th><th>ژمارەی وشە</th><th>ژمارەی پیت</th></tr></thead>
            <tbody>${last5.map(e => `
                <tr>
                    <td>${new Date(e.time).toLocaleString("ku")}</td>
                    <td>${e.words}</td>
                    <td>${e.chars}</td>
                </tr>`).join("")}
            </tbody>
        </table>`;
    }

    // نشستەکان
    const sesEl = document.getElementById("sessionList");
    const last10 = [...data.sessions].reverse().slice(0, 10);
    if (!last10.length) {
        sesEl.innerHTML = `<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا سەردانێک تۆمار نەکراوە</div>`;
    } else {
        sesEl.innerHTML = `
        <table class="stats-table">
            <thead><tr><th>#</th><th>کاتی سەردان</th></tr></thead>
            <tbody>${last10.map((s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${new Date(s.start).toLocaleString("ku")}</td>
                </tr>`).join("")}
            </tbody>
        </table>`;
    }
}

function clearStats() {
    if (!confirm("دڵنیایت لە سڕینەوەی هەموو داتاکان؟")) return;
    localStorage.removeItem(AK_KEY);
    loadStats();
    showToast("✅ داتاکان سڕایەوە");
}

 — لە کۆنسۆڵدا پیشان دەدات
function generateCode() {
    const rss = JSON.parse(localStorage.getItem("rssSources") || "null");
    const btns = JSON.parse(localStorage.getItem("toolbarBtns") || "null");

    console.log("=== RSS Code بۆ index.html ===");
    if (rss) {
        const rssCode = `const rssSources = [\n${rss.map(s => `    { name: '${s.name}', url: '${s.url}' }`).join(",\n")}\n];`;
        console.log(rssCode);
    }

    console.log("\n=== Toolbar Buttons Code بۆ index.html ===");
    if (btns) {
        const btnCode = btns.map(b =>
            `<button class="news-ticker-btn" style="background:${b.color};" onclick="${b.action}">${b.label}</button>`
        ).join("\n");
        console.log(btnCode);
    }
}

// ---- پشاندانی پانێل ئەگەر پێشتر لۆگین کراوە ----
window.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem("adminAuth") === "1") {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";
        initPanel();
    }
});
