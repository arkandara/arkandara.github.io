// ===========================
//  ئەدمین پانێل — JavaScript
//  سەکۆی ڕۆژنامەنووس
// ===========================

const ADMIN_USERNAME = "admin";
// پاسوۆرد — دەتوانی لە تابی "گۆڕینی پاسوۆرد" بیگۆڕیت
let ADMIN_PASS = localStorage.getItem("adminPass") || "arkandara2024";

// ---- لۆگین ----
function doLogin() {
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value;
    const errEl = document.getElementById("loginError");

    if (!user || !pass) {
        errEl.style.display = "flex";
        errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> تکایە هەموو خانەکان پڕ بکەرەوە';
        return;
    }

    if (user === ADMIN_USERNAME && pass === ADMIN_PASS) {
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
    document.querySelectorAll(".tab-content").forEach(function(el) { el.classList.remove("active"); });
    document.querySelectorAll(".nav-item").forEach(function(el) { el.classList.remove("active"); });
    document.getElementById(id).classList.add("active");
    var navId = "nav-" + id.replace("tab-", "");
    var navEl = document.getElementById(navId);
    if (navEl) navEl.classList.add("active");
    document.getElementById("pageTitle").textContent = tabTitles[id] || "";
    if (id === "tab-stats") loadStats();
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
    var colorInput = document.getElementById("primaryColor");
    if (colorInput) {
        colorInput.addEventListener("input", function() {
            document.getElementById("primaryHex").textContent = colorInput.value;
        });
    }
}

// ===========================
//  تاب ١ — زانیاری سایت
// ===========================

var SITE_DEFAULTS = {
    siteName: "سه‌كۆی ڕۆژنامه‌نووس",
    siteAuthor: "Arkan Dara",
    siteTitle: "سه‌كۆی ڕۆژنامه‌نووس",
    siteDesc: "گۆڕینی فۆنتی عەلی بۆ یونیکۆد (Ali K to Unicode), سه‌كۆی ڕۆژنامه‌نووس",
    primaryColor: "#2e7d32",
    bismillahText: "بِسْمِ اللَّهِ",
    bismillahSub: "سه‌كۆی ڕۆژنامه‌نووس"
};

function loadSiteInfo() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("siteInfo") || "{}"); } catch(e) {}
    var data = Object.assign({}, SITE_DEFAULTS, saved);
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
    var data = {
        siteName: document.getElementById("siteName").value.trim(),
        siteAuthor: document.getElementById("siteAuthor").value.trim(),
        siteTitle: document.getElementById("siteTitle").value.trim(),
        siteDesc: document.getElementById("siteDesc").value.trim(),
        primaryColor: document.getElementById("primaryColor").value,
        bismillahText: document.getElementById("bismillahText").value.trim(),
        bismillahSub: document.getElementById("bismillahSub").value.trim()
    };
    localStorage.setItem("siteInfo", JSON.stringify(data));
    showToast("✅ زانیاری سایت پاشەکەوت کرا!");
}

// ===========================
//  تاب ٢ — RSS سەرچاوەکان
// ===========================

var RSS_DEFAULTS = [
    { name: 'الجزيرة', url: 'https://www.aljazeera.net/rss' },
    { name: 'سكاى نيوز', url: 'https://www.skynewsarabia.com/rss' },
    { name: 'العراقية', url: 'https://news.google.com/rss/search?q=وكالة+الأنباء+العراقية+INA&hl=ar&gl=IQ&ceid=IQ:ar&tbs=qdr:h' },
    { name: 'روسیا الیوم', url: 'https://arabic.rt.com/rss/' },
    { name: 'عربي جديد', url: 'https://www.alaraby.co.uk/rss' }
];

function loadRssSources() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem("rssSources")); } catch(e) {}
    var sources = saved || RSS_DEFAULTS;
    var list = document.getElementById("rssList");
    list.innerHTML = "";
    sources.forEach(function(s) { addRssRow(s.name, s.url); });
}

function addRssRow(name, url) {
    name = name || "";
    url = url || "";
    var list = document.getElementById("rssList");
    var row = document.createElement("div");
    row.className = "rss-row";
    row.innerHTML =
        '<input type="text" placeholder="ناوی سەرچاوە" value="' + escHtml(name) + '" class="rss-name">' +
        '<input type="url" placeholder="ئادرەسی RSS" value="' + escHtml(url) + '" class="url-input rss-url" dir="ltr">' +
        '<button class="del-btn" onclick="this.closest(\'.rss-row\').remove()" title="سڕینەوە"><i class="fas fa-trash"></i></button>';
    list.appendChild(row);
}

function saveRss() {
    var rows = document.querySelectorAll(".rss-row");
    var sources = [];
    var valid = true;
    rows.forEach(function(row) {
        var name = row.querySelector(".rss-name").value.trim();
        var url = row.querySelector(".rss-url").value.trim();
        if (name && url) sources.push({ name: name, url: url });
        else if (name || url) valid = false;
    });
    if (!valid) { showToast("⚠️ تکایە هەموو خانەکانی ناو و ئادرەس پڕ بکەرەوە", true); return; }
    localStorage.setItem("rssSources", JSON.stringify(sources));
    showToast("✅ سەرچاوەکانی هەواڵ پاشەکەوت کران!");
}

// ===========================
//  تاب ٣ — دوگمەکانی تووڵبار
// ===========================

var BTN_DEFAULTS = [
    { label: "سڕینه‌وه‌ی‌ بۆشایی دێڕه‌كان", color: "#ff9800", action: "removeEmptyLines()" },
    { label: "گەڕان و گۆڕینی وشه‌ 🔍", color: "#e91e63", action: "toggleFindReplace()" },
    { label: "هێنانی Word", color: "#607d8b", action: "document.getElementById('fileInput').click()" },
    { label: "تێكستی ناو وێنه 🖼️", color: "#808080", action: "triggerOcrInput()" },
    { label: "داگرتنی ڤیدیۆ", color: "#1a73e8", action: "toggleDlModal()" }
];

function loadButtons() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem("toolbarBtns")); } catch(e) {}
    var btns = saved || BTN_DEFAULTS;
    var list = document.getElementById("btnList");
    list.innerHTML = "";
    btns.forEach(function(b) { addBtnRow(b.label, b.color, b.action); });
}

function addBtnRow(label, color, action) {
    label = label || "";
    color = color || "#2e7d32";
    action = action || "";
    var list = document.getElementById("btnList");
    var row = document.createElement("div");
    row.className = "btn-row";
    row.innerHTML =
        '<input type="color" class="btn-color-preview" value="' + escHtml(color) + '" title="ڕەنگ">' +
        '<input type="text" placeholder="تێکستی دوگمە" value="' + escHtml(label) + '" class="btn-label">' +
        '<input type="text" placeholder="فەنکشن (onclick)" value="' + escHtml(action) + '" class="btn-action" dir="ltr" style="font-family:monospace;font-size:0.82em;">' +
        '<button class="del-btn" onclick="this.closest(\'.btn-row\').remove()" title="سڕینەوە"><i class="fas fa-trash"></i></button>';
    list.appendChild(row);
}

function saveButtons() {
    var rows = document.querySelectorAll(".btn-row");
    var btns = [];
    rows.forEach(function(row) {
        var label = row.querySelector(".btn-label").value.trim();
        var color = row.querySelector(".btn-color-preview").value;
        var action = row.querySelector(".btn-action").value.trim();
        if (label) btns.push({ label: label, color: color, action: action });
    });
    localStorage.setItem("toolbarBtns", JSON.stringify(btns));
    showToast("✅ دوگمەکانی تووڵبار پاشەکەوت کران!");
}

// ===========================
//  تاب ٤ — ئامارەکان
// ===========================

var AK_KEY = "ak_stats";

function akLoad() {
    try { return JSON.parse(localStorage.getItem(AK_KEY) || "null") || { clicks: {}, sessions: [], textEvents: [] }; }
    catch(e) { return { clicks: {}, sessions: [], textEvents: [] }; }
}

function loadStats() {
    var data = akLoad();
    var totalClicks = Object.values(data.clicks).reduce(function(s, v) { return s + v.count; }, 0);
    var totalSessions = data.sessions.length;
    var totalTextSaves = data.textEvents.length;
    var avgWords = totalTextSaves
        ? Math.round(data.textEvents.reduce(function(s, e) { return s + e.words; }, 0) / totalTextSaves)
        : 0;

    var topGrid = document.getElementById("statsTopGrid");
    if (!topGrid) return;
    topGrid.innerHTML =
        '<div class="stat-card"><div class="stat-num">' + totalClicks + '</div><div class="stat-lbl"><i class="fas fa-mouse-pointer"></i> گشتی کلیکەکان</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + totalSessions + '</div><div class="stat-lbl"><i class="fas fa-globe"></i> سەردانەکان</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + totalTextSaves + '</div><div class="stat-lbl"><i class="fas fa-keyboard"></i> جار تێکست بەکارهاتووە</div></div>' +
        '<div class="stat-card"><div class="stat-num">' + avgWords + '</div><div class="stat-lbl"><i class="fas fa-align-left"></i> ناوەندی وشەکان</div></div>';

    // چارتی کلیکەکان
    var clicks = data.clicks;
    var sorted = Object.entries(clicks).sort(function(a, b) { return b[1].count - a[1].count; });
    var maxCount = sorted.length ? sorted[0][1].count : 1;
    var chartEl = document.getElementById("clickChart");
    if (!chartEl) return;
    if (!sorted.length) {
        chartEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا داتایەک نییە</div>';
    } else {
        chartEl.innerHTML = sorted.map(function(item) {
            var name = item[0], val = item[1];
            var pct = Math.round((val.count / maxCount) * 100);
            var last = val.last ? new Date(val.last).toLocaleString() : "-";
            return '<div class="bar-row">' +
                '<div class="bar-label">' + escHtml(name) + '</div>' +
                '<div class="bar-wrap"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
                '<div class="bar-count">' + val.count + '</div>' +
                '<div class="bar-last">' + last + '</div>' +
                '</div>';
        }).join("");
    }

    // تێکستی داخڵکراو — بە پێشبینی و ناوی دوگمە
    var txtEl = document.getElementById("textStats");
    if (!txtEl) return;
    if (!data.textEvents || !data.textEvents.length) {
        txtEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا تێکستێک تۆمار نەکراوە — کاتێک بەکارهێنەر دوگمەیەک کلیک دەکات تۆمار دەکرێت</div>';
    } else {
        var last10txt = data.textEvents.slice().reverse().slice(0, 10);
        var trows = last10txt.map(function(e) {
            return '<tr>' +
                '<td>' + new Date(e.time).toLocaleString() + '</td>' +
                '<td><span class="badge-btn">' + escHtml(e.btn || "-") + '</span></td>' +
                '<td>' + (e.words || 0) + ' وشە / ' + (e.chars || 0) + ' پیت</td>' +
                '<td class="text-preview">' + escHtml(e.preview || "") + '</td>' +
                '</tr>';
        }).join("");
        txtEl.innerHTML = '<table class="stats-table">' +
            '<thead><tr><th>کات</th><th>دوگمە</th><th>قەبارە</th><th>پێشبینی تێکست</th></tr></thead>' +
            '<tbody>' + trows + '</tbody></table>';
    }

    // سەردانەکان — بە شار و وڵات
    var sesEl = document.getElementById("sessionList");
    if (!sesEl) return;
    var last15 = data.sessions.slice().reverse().slice(0, 15);
    if (!last15.length) {
        sesEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا سەردانێک تۆمار نەکراوە</div>';
    } else {
        var srows = last15.map(function(s, i) {
            var flag = s.country && s.country !== "---" ? "" : "";
            var location = (s.city && s.city !== "---" ? s.city : "") +
                           (s.city && s.city !== "---" && s.country && s.country !== "---" ? "، " : "") +
                           (s.country && s.country !== "---" ? s.country : "نەناسراو");
            var region = s.region ? '<span class="text-muted"> (' + escHtml(s.region) + ')</span>' : "";
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + new Date(s.start).toLocaleString() + '</td>' +
                '<td><i class="fas fa-map-marker-alt" style="color:#e53935;margin-left:4px;"></i>' + escHtml(location) + region + '</td>' +
                '</tr>';
        }).join("");
        sesEl.innerHTML = '<table class="stats-table">' +
            '<thead><tr><th>#</th><th>کاتی سەردان</th><th>شار و وڵات</th></tr></thead>' +
            '<tbody>' + srows + '</tbody></table>';
    }
}

function clearStats() {
    if (!confirm("دڵنیایت لە سڕینەوەی هەموو داتاکان؟")) return;
    localStorage.removeItem(AK_KEY);
    loadStats();
    showToast("✅ داتاکان سڕایەوە");
}

// ===========================
//  تاب ٥ — گۆڕینی پاسوۆرد
// ===========================

function changePassword() {
    var oldPass = document.getElementById("oldPass").value;
    var newPass = document.getElementById("newPass").value;
    var confirmPass = document.getElementById("confirmPass").value;
    var msgEl = document.getElementById("passMsg");

    if (oldPass !== ADMIN_PASS) {
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
    ADMIN_PASS = newPass;
    localStorage.setItem("adminPass", newPass);
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

function showToast(msg, isError) {
    var toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = "toast" + (isError ? " error" : "");
    toast.classList.add("show");
    setTimeout(function() { toast.classList.remove("show"); }, 3500);
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ---- پشاندانی پانێل ئەگەر پێشتر لۆگین کراوە ----
window.addEventListener("DOMContentLoaded", function() {
    if (sessionStorage.getItem("adminAuth") === "1") {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";
        initPanel();
    }
});
