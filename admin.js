// ===========================
//  ئەدمین پانێل — JavaScript
//  سەکۆی ڕۆژنامەنووس
//  نسخەی نوێ: بەبێ Firebase — داتا لە Cloudflare KV
// ===========================

const ADMIN_USERNAME = "admin";
let ADMIN_PASS = localStorage.getItem("adminPass") || "arkandara2024";

// ===========================
//  لۆگین / دەرچوون
// ===========================

function doLogin() {
    const user  = document.getElementById("loginUser").value.trim();
    const pass  = document.getElementById("loginPass").value;
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

function doLogout() {
    sessionStorage.removeItem("adminAuth");
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginUser").value = "";
    document.getElementById("loginPass").value = "";
}

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

// ===========================
//  دەستپێکردنی پانێڵ
// ===========================

function initPanel() {
    loadSiteInfo();
    loadRssSources();
    loadButtons();

    var colorInput = document.getElementById("primaryColor");
    if (colorInput) {
        colorInput.addEventListener("input", function () {
            document.getElementById("primaryHex").textContent = colorInput.value;
        });
    }

    // ---- بپشکنە URL: ئەگەر ?tab=preview بوو → تابی preview ----
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tab") === "preview") {
        showTab("tab-preview");
    } else {
        showTab("tab-stats");
    }
}

// ===========================
//  تاب و سایدبار
// ===========================

const tabTitles = {
    "tab-site":     "زانیاری سایت",
    "tab-news":     "سەرچاوەی هەواڵ",
    "tab-buttons":  "دوگمەکانی تووڵبار",
    "tab-stats":    "ئامارەکان",
    "tab-archive":  "ئەرشیفی هەفتانە",
    "tab-password": "گۆڕینی پاسوۆرد",
    "tab-preview":  "بینینی دەقی سایت"
};

function showTab(id) {
    var tabEl = document.getElementById(id);
    if (!tabEl) { console.warn("showTab: tab not found:", id); return; }
    document.querySelectorAll(".tab-content").forEach(function(el) { el.classList.remove("active"); });
    document.querySelectorAll(".nav-item").forEach(function(el) { el.classList.remove("active"); });
    tabEl.classList.add("active");
    var navEl = document.getElementById("nav-" + id.replace("tab-", ""));
    if (navEl) navEl.classList.add("active");
    var titleEl = document.getElementById("pageTitle");
    if (titleEl) titleEl.textContent = tabTitles[id] || "";
    if (id === "tab-stats")   { loadStats(); loadStatsCharts(); }
    if (id === "tab-archive") loadArchiveList();
    if (id === "tab-preview") loadPreviewText();
    if (window.innerWidth <= 700) {
        var sb = document.getElementById("sidebar");
        if (sb) sb.classList.remove("open");
    }
}


function resetAdminPass() {
    if (confirm("دڵنیایت لە ڕیسێتکردنی پاسوۆرد؟\nپاسوۆردەکە دەگەڕێتەوە بۆ: arkandara2024")) {
        localStorage.removeItem("adminPass");
        ADMIN_PASS = "arkandara2024";
        var errEl = document.getElementById("loginError");
        if (errEl) {
            errEl.style.display = "flex";
            errEl.style.background = "#e8f5e9";
            errEl.style.color = "#2e7d32";
            errEl.innerHTML = '<i class="fas fa-check-circle"></i> پاسوۆرد ڕیسێت کرا: arkandara2024';
        }
    }
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

// ===========================
//  تاب ١ — زانیاری سایت (localStorage)
// ===========================

var SITE_DEFAULTS = {
    siteName:      "سه‌كۆی ڕۆژنامه‌نووس",
    siteAuthor:    "Arkan Dara",
    siteTitle:     "سه‌كۆی ڕۆژنامه‌نووس",
    siteDesc:      "گۆڕینی فۆنتی عەلی بۆ یونیکۆد (Ali K to Unicode)",
    primaryColor:  "#2e7d32",
    bismillahText: "بِسْمِ اللَّهِ",
    bismillahSub:  "سه‌كۆی ڕۆژنامه‌نووس"
};

function loadSiteInfo() {
    fetch("/track")
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var data = Object.assign({}, SITE_DEFAULTS, d.settings || {});
            document.getElementById("siteName").value         = data.siteName;
            document.getElementById("siteAuthor").value       = data.siteAuthor;
            document.getElementById("siteTitle").value        = data.siteTitle;
            document.getElementById("siteDesc").value         = data.siteDesc;
            document.getElementById("primaryColor").value     = data.primaryColor;
            document.getElementById("primaryHex").textContent = data.primaryColor;
            document.getElementById("bismillahText").value    = data.bismillahText;
            document.getElementById("bismillahSub").value     = data.bismillahSub;
        })
        .catch(function() {
            // fallback بۆ default
            var data = SITE_DEFAULTS;
            document.getElementById("siteName").value         = data.siteName;
            document.getElementById("siteAuthor").value       = data.siteAuthor;
            document.getElementById("siteTitle").value        = data.siteTitle;
            document.getElementById("siteDesc").value         = data.siteDesc;
            document.getElementById("primaryColor").value     = data.primaryColor;
            document.getElementById("primaryHex").textContent = data.primaryColor;
            document.getElementById("bismillahText").value    = data.bismillahText;
            document.getElementById("bismillahSub").value     = data.bismillahSub;
        });
}

function saveSiteInfo() {
    var data = {
        siteName:      document.getElementById("siteName").value.trim(),
        siteAuthor:    document.getElementById("siteAuthor").value.trim(),
        siteTitle:     document.getElementById("siteTitle").value.trim(),
        siteDesc:      document.getElementById("siteDesc").value.trim(),
        primaryColor:  document.getElementById("primaryColor").value,
        bismillahText: document.getElementById("bismillahText").value.trim(),
        bismillahSub:  document.getElementById("bismillahSub").value.trim()
    };
    // پاشەکەوتکردن لە KV (جیهانی)
    fetch("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ type: "settings" }, data))
    }).then(function(r) { return r.json(); })
    .then(function() { showToast("✅ زانیاری سایت پاشەکەوت کرا!"); })
    .catch(function() { showToast("⚠️ هەڵە لە پاشەکەوتکردن", true); });
}

// ===========================
//  تاب ٢ — RSS (localStorage)
// ===========================

var RSS_DEFAULTS = [
    { name: "الجزيرة",     url: "https://www.aljazeera.net/rss" },
    { name: "سكاى نيوز",   url: "https://www.skynewsarabia.com/rss" },
    { name: "العراقية",    url: "https://news.google.com/rss/search?q=وكالة+الأنباء+العراقية+INA&hl=ar&gl=IQ&ceid=IQ:ar" },
    { name: "روسیا الیوم", url: "https://arabic.rt.com/rss/" },
    { name: "عربي جديد",   url: "https://www.alaraby.co.uk/rss" }
];

function loadRssSources() {
    fetch("/track")
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var sources = (d.settings && d.settings.rssSources) ? d.settings.rssSources : RSS_DEFAULTS;
            var list = document.getElementById("rssList");
            if (list) { list.innerHTML = ""; sources.forEach(function(s) { addRssRow(s.name, s.url); }); }
        })
        .catch(function() {
            var list = document.getElementById("rssList");
            if (list) { list.innerHTML = ""; RSS_DEFAULTS.forEach(function(s) { addRssRow(s.name, s.url); }); }
        });
}

function addRssRow(name, url) {
    name = name || "";
    url  = url  || "";
    var list = document.getElementById("rssList");
    var row  = document.createElement("div");
    row.className = "rss-row";
    row.innerHTML =
        '<input type="text" placeholder="ناوی سەرچاوە" value="' + escHtml(name) + '" class="rss-name">' +
        '<input type="url" placeholder="ئادرەسی RSS" value="' + escHtml(url) + '" class="url-input rss-url" dir="ltr">' +
        '<button class="del-btn" onclick="this.closest(\'.rss-row\').remove()" title="سڕینەوە"><i class="fas fa-trash"></i></button>';
    list.appendChild(row);
}

function saveRss() {
    var rows    = document.querySelectorAll(".rss-row");
    var sources = [];
    var valid   = true;
    rows.forEach(function(row) {
        var name = row.querySelector(".rss-name").value.trim();
        var url  = row.querySelector(".rss-url").value.trim();
        if (name && url) sources.push({ name: name, url: url });
        else if (name || url) valid = false;
    });
    if (!valid) { showToast("⚠️ تکایە هەموو خانەکانی ناو و ئادرەس پڕ بکەرەوە", true); return; }
    fetch("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "settings", rssSources: sources })
    }).then(function() { showToast("✅ سەرچاوەکانی هەواڵ پاشەکەوت کران!"); })
    .catch(function() { showToast("⚠️ هەڵە لە پاشەکەوتکردن", true); });
}

// ===========================
//  تاب ٣ — دوگمەکان (localStorage)
// ===========================

var BTN_DEFAULTS = [
    // ---- گروپی تووڵبار (btn-group) ----
    { label: "↺ یونیكۆد - ڕێنووس",       color: "#4caf50", action: "convert('toUni')",    group: "toolbar", cls: "btn-uni" },
    { label: "↻ عەلی کەی",               color: "#d4ac0d", action: "convert('toAli')",    group: "toolbar", cls: "btn-ali" },
    { label: "✂️ كه‌تكردن",              color: "#607d8b", action: "copyText()",           group: "toolbar", cls: "btn-copy" },
    { label: "🗑️ سڕینه‌وه‌",            color: "#f44336", action: "clearText()",          group: "toolbar", cls: "btn-clear" },
    { label: "✦ Gemini",                  color: "#1a73e8", action: "sendToGemini()",       group: "toolbar", cls: "btn-nav" },
    { label: "💾 پاشه‌كه‌وتكردن",        color: "#2b5797", action: "downloadAsWord()",     group: "toolbar", cls: "btn-nav", fixed: true },
    // ---- گروپی تیکەر (news-ticker) ----
    { label: "سڕینه‌وه‌ی بۆشایی دێڕه‌كان", color: "#ff9800", action: "removeEmptyLines()",                         group: "ticker" },
    { label: "گەڕان و گۆڕینی وشه‌ 🔍",    color: "#e91e63", action: "toggleFindReplace()",                          group: "ticker" },
    { label: "هێنانی Word",               color: "#607d8b", action: "document.getElementById('fileInput').click()", group: "ticker" },
    { label: "تێكستی ناو وێنه 🖼️",       color: "#808080", action: "triggerOcrInput()",                            group: "ticker" },
    { label: "داگرتنی ڤیدیۆ",             color: "#1a73e8", action: "toggleDlModal()",                              group: "ticker" }
];

// نقشەی action بۆ cls — بۆ ئەوەی KV کۆنەکە ئۆتۆماتیک درووست بێت
function getClsFromAction(action) {
    if (!action) return 'btn-nav';
    if (action.includes('toUni'))    return 'btn-uni';
    if (action.includes('toAli'))    return 'btn-ali';
    if (action.includes('copyText')) return 'btn-copy';
    if (action.includes('clearText')) return 'btn-clear';
    return 'btn-nav';
}

function loadButtons() {
    fetch("/track")
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var btns = (d.settings && d.settings.toolbarBtns) ? d.settings.toolbarBtns : BTN_DEFAULTS;
            // ئۆتۆماتیک cls زیاد بکە ئەگەر نەبوو (KV کۆن)
            btns = btns.map(function(b) {
                if (!b.cls) b.cls = getClsFromAction(b.action);
                return b;
            });
            var list = document.getElementById("btnList");
            if (list) { list.innerHTML = ""; btns.forEach(function(b) { addBtnRow(b.label, b.color, b.action, b.group, b.fixed, b.cls); }); }
        })
        .catch(function() {
            var list = document.getElementById("btnList");
            if (list) { list.innerHTML = ""; BTN_DEFAULTS.forEach(function(b) { addBtnRow(b.label, b.color, b.action, b.group, b.fixed, b.cls); }); }
        });
}

function addBtnRow(label, color, action, group, fixed, cls) {
    label  = label  || "";
    color  = color  || "#2e7d32";
    action = action || "";
    group  = group  || "toolbar";
    fixed  = fixed  || false;

    var list = document.getElementById("btnList");
    var row  = document.createElement("div");
    row.className = "btn-row";

    var groupBadge = group === "ticker"
        ? '<span style="font-size:0.72em;background:#fff3e0;color:#e65100;padding:2px 7px;border-radius:4px;border:1px solid #ffe0b2;">تیکەر</span>'
        : '<span style="font-size:0.72em;background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;border:1px solid #c8e6c9;">تووڵبار</span>';

    var delBtn = fixed
        ? '<span style="font-size:0.72em;color:#aaa;padding:0 8px;"><i class="fas fa-lock"></i></span>'
        : '<button class="del-btn" onclick="this.closest(\'.btn-row\').remove()" title="سڕینەوە"><i class="fas fa-trash"></i></button>';

    row.innerHTML =
        '<input type="hidden" class="btn-group-val" value="' + escHtml(group) + '">' +
        '<input type="hidden" class="btn-fixed-val" value="' + (fixed ? "1" : "0") + '">' +
        '<input type="color" value="' + escHtml(color) + '" class="btn-color-preview" title="ڕەنگ">' +
        groupBadge +
        '<input type="text" placeholder="تێکستی دوگمە" value="' + escHtml(label) + '" class="btn-label" style="flex:1;">' +
        '<input type="text" placeholder="فەنکشن (onclick)" value="' + escHtml(action) + '" class="btn-action" dir="ltr" style="font-family:monospace;font-size:0.82em;flex:1.2;">' +
        delBtn;
    list.appendChild(row);
}

function saveButtons() {
    var rows = document.querySelectorAll(".btn-row");
    var btns = [];
    rows.forEach(function(row) {
        var label  = row.querySelector(".btn-label").value.trim();
        var color  = row.querySelector(".btn-color-preview").value;
        var action = row.querySelector(".btn-action").value.trim();
        var group  = row.querySelector(".btn-group-val")  ? row.querySelector(".btn-group-val").value  : "toolbar";
        var fixed  = row.querySelector(".btn-fixed-val")  ? row.querySelector(".btn-fixed-val").value === "1" : false;
        if (label) btns.push({ label: label, color: color, action: action, group: group, fixed: fixed, cls: getClsFromAction(action) });
    });
    fetch("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "settings", toolbarBtns: btns })
    }).then(function() { showToast("✅ دوگمەکانی تووڵبار پاشەکەوت کران!"); })
    .catch(function() { showToast("⚠️ هەڵە لە پاشەکەوتکردن", true); });
}

// ===========================
//  تاب ٤ — ئامارەکان (Cloudflare KV)
// ===========================

function loadStats() {
    setEl("stat-total-visits",  "⏳");
    setEl("stat-total-clicks",  "⏳");
    setEl("stat-btn-count",     "⏳");
    setEl("stat-top-btn",       "⏳");
    setEl("stat-total-textarea","⏳");
    setEl("stat-kv-usage",      "⏳");

    fetch("/track")
        .then(function(r) {
            if (!r.ok) throw new Error("هەڵەی " + r.status);
            return r.json();
        })
        .then(function(data) {
            var clicks  = data.clicks  || {};
            var btnCount    = Object.keys(clicks).length;
            var totalClicks = Object.values(clicks).reduce(function(s, v) { return s + v; }, 0);
            var topBtn = "—";
            if (btnCount > 0) {
                topBtn = Object.entries(clicks).sort(function(a, b) { return b[1] - a[1]; })[0][0];
            }

            setEl("stat-total-visits",   data.totalVisits   || 0);
            setEl("stat-total-clicks",   totalClicks);
            setEl("stat-btn-count",      btnCount);
            setEl("stat-top-btn",        topBtn);
            setEl("stat-total-textarea", data.totalTextarea || 0);

            renderClickChart(clicks);
            renderSessions(data.recentSessions || []);
            renderSnapshots(data.snapshots || []);
            renderKvUsage(data.kvUsage || null);
        })
        .catch(function(err) {
            showToast("⚠️ هەڵە لە بارکردنی ئامارەکان: " + err.message, true);
            setEl("stat-total-visits",  "—");
            setEl("stat-total-clicks",  "—");
            setEl("stat-btn-count",     "—");
            setEl("stat-top-btn",       "—");
            setEl("stat-total-textarea","—");
            setEl("stat-kv-usage",      "—");
        });
}

function renderClick
