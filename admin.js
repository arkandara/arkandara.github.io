// ===========================
//  ئەدمین پانێل — JavaScript
//  سەکۆی ڕۆژنامەنووس
//  نسخەی نوێ: بەبێ Firebase — داتا لە Cloudflare KV
// ===========================

const ADMIN_USERNAME = "admin";
// پاسۆردی پێش‌نیازی: SHA-256 ی "arkandara2024"
const DEFAULT_PASS_HASH = "95a5d03a1cbc38f0a1cf2dd9d60faa4ac996524b27cfec444e1172107df32bfb";

async function hashPassword(pass) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pass);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSavedPassHash() {
    try {
        const res = await fetch("/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "admin_pass_get" })
        });
        const data = await res.json();
        return data.hash || DEFAULT_PASS_HASH;
    } catch(e) {
        return DEFAULT_PASS_HASH;
    }
}

// ===========================
//  لۆگین / دەرچوون
// ===========================

async function doLogin() {
    const user  = document.getElementById("loginUser").value.trim();
    const pass  = document.getElementById("loginPass").value;
    const errEl = document.getElementById("loginError");

    if (!user || !pass) {
        errEl.style.display = "flex";
        errEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> تکایە هەموو خانەکان پڕ بکەرەوە';
        return;
    }
    const passHash = await hashPassword(pass);
    if (user === ADMIN_USERNAME && passHash === await getSavedPassHash()) {
        sessionStorage.setItem("adminAuth", "1");
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";
        if (window.innerWidth > 768) {
            document.getElementById("sidebar").classList.add("open");
        }
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
    document.querySelectorAll(".top-nav-btn").forEach(function(el) { el.classList.remove("active"); });
    tabEl.classList.add("active");
    var tnavEl = document.getElementById("tnav-" + id.replace("tab-", ""));
    if (tnavEl) tnavEl.classList.add("active");
    var navEl = document.getElementById("nav-" + id.replace("tab-", ""));
    if (navEl) navEl.classList.add("active");
    var titleEl = document.getElementById("pageTitle");
    if (titleEl) titleEl.textContent = tabTitles[id] || "";
    if (id === "tab-stats") {
        loadStats(); loadStatsCharts();
        // ئۆتۆماتیک نوێکردنەوە هەر 5 چرکە کاتێک تابی ئامارەکان کراوەیە
        if (window._statsInterval) clearInterval(window._statsInterval);
        window._statsInterval = setInterval(function() {
            var activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'tab-stats') {
                loadStats();
            } else {
                clearInterval(window._statsInterval);
            }
        }, 120000);
    }
    if (id === "tab-archive") loadArchiveList();
    if (id === "tab-preview") loadPreviewText();
}


function resetAdminPass() {
    if (confirm("دڵنیایت لە ڕیسێتکردنی پاسوۆرد؟\nپاسوۆردەکە: arkandara2024")) {
        localStorage.clear();
        sessionStorage.clear();
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
    var sb = document.getElementById("sidebar");
    var ov = document.getElementById("sidebarOverlay");
    var isOpen = sb.classList.toggle("open");
    if (ov) ov.classList.toggle("active", isOpen);
}

function closeSidebar() {
    var sb = document.getElementById("sidebar");
    var ov = document.getElementById("sidebarOverlay");
    if (sb) sb.classList.remove("open");
    if (ov) ov.classList.remove("active");
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
    bismillahSub:  "سه‌كۆی ڕۆژنامه‌نووس",
    updateText:    "نوێترین ئه‌بده‌یت  23ـی نیسانی 2026"
};

var _siteInfoLoaded = false;
function loadSiteInfo(force) {
    if (_siteInfoLoaded && !force) return;
    fetch("/track")
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var kvSettings = d.settings || {};
            // تەنها fieldە خاڵییەکان لە SITE_DEFAULTS بگرێت
            var data = {};
            Object.keys(SITE_DEFAULTS).forEach(function(k) {
                data[k] = (kvSettings[k] !== undefined && kvSettings[k] !== "") ? kvSettings[k] : SITE_DEFAULTS[k];
            });
            // ئەگەر sessionStorage draft هەبوو (گۆڕانکاری پاشەکەوت نەکراو)، ئەوەی بخوێنەوە
            var ss = sessionStorage.getItem("siteInfoDraft");
            if (ss) { try { var draft = JSON.parse(ss); Object.keys(draft).forEach(function(k){ if(draft[k] !== "") data[k] = draft[k]; }); } catch(e) {} }
            document.getElementById("siteName").value         = data.siteName;
            document.getElementById("siteAuthor").value       = data.siteAuthor;
            document.getElementById("siteTitle").value        = data.siteTitle;
            document.getElementById("siteDesc").value         = data.siteDesc;
            document.getElementById("primaryColor").value     = data.primaryColor;
            document.getElementById("primaryHex").textContent = data.primaryColor;
            document.getElementById("bismillahText").value    = data.bismillahText;
            document.getElementById("bismillahSub").value     = data.bismillahSub;
            document.getElementById("updateText").value       = data.updateText || "";
            _siteInfoLoaded = true;
            // گوێگری زیاد بکە بۆ هەموو input-ەکان
            ["siteName","siteAuthor","siteTitle","siteDesc","primaryColor","bismillahText","bismillahSub","updateText"].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.addEventListener("input", saveSiteInfoDraft);
            });
        });
}

function saveSiteInfoDraft() {
    var draft = {
        siteName:      document.getElementById("siteName").value,
        siteAuthor:    document.getElementById("siteAuthor").value,
        siteTitle:     document.getElementById("siteTitle").value,
        siteDesc:      document.getElementById("siteDesc").value,
        primaryColor:  document.getElementById("primaryColor").value,
        bismillahText: document.getElementById("bismillahText").value,
        bismillahSub:  document.getElementById("bismillahSub").value,
        updateText:    document.getElementById("updateText").value
    };
    sessionStorage.setItem("siteInfoDraft", JSON.stringify(draft));
}

function saveSiteInfo() {
    var data = {
        siteName:      document.getElementById("siteName").value.trim(),
        siteAuthor:    document.getElementById("siteAuthor").value.trim(),
        siteTitle:     document.getElementById("siteTitle").value.trim(),
        siteDesc:      document.getElementById("siteDesc").value.trim(),
        updateText:    document.getElementById("updateText").value.trim(),
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
    .then(function() { _siteInfoLoaded = false; sessionStorage.removeItem("siteInfoDraft"); showToast("✅ زانیاری سایت پاشەکەوت کرا!"); })
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

    fetch("/track?full=1")
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
            // تێکست لە هەردوو سەرچاوە: textarea + snapshot (کۆپیکردن)
            var txItems = (data.textareaToday || []).map(function(s) {
                var methodMap = {
                    'paste':              'پەیستکراوە',
                    'Ctrl+V':             'Ctrl+V پەیستکراوە',
                    'Ctrl+X':             'Ctrl+X کەتکرا',
                    'کەتکردن': 'کەتکرا',
                    'Word':               'هێنانی Word'
                };
                var lbl = methodMap[s.method] || s.method || 'پەیستکراوە';
                return { time: s.time, label: lbl, length: s.length, text: s.text };
            });
            var snapItems = (data.snapshots || []).filter(function(s) { return s.text && s.text.trim().length > 0; });
            var allTexts = txItems.concat(snapItems).sort(function(a, b) {
                return new Date(b.time || 0) - new Date(a.time || 0);
            });
            renderSnapshots(allTexts);
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

function renderClickChart(clicks) {
    var chartEl = document.getElementById("clickChart");
    if (!chartEl) return;

    if (!clicks || Object.keys(clicks).length === 0) {
        chartEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا داتایەک نییە</div>';
        return;
    }

    var sorted   = Object.entries(clicks).sort(function(a, b) { return b[1] - a[1]; });
    var maxCount = sorted[0][1] || 1;

    chartEl.innerHTML = sorted.map(function(item) {
        var pct = Math.round((item[1] / maxCount) * 100);
        return '<div class="bar-row">' +
            '<div class="bar-label">' + escHtml(item[0]) + '</div>' +
            '<div class="bar-wrap"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="bar-count">' + item[1] + '</div>' +
            '</div>';
    }).join("");
}


function renderDeviceCityMeta(a) {
    var ds = a.deviceStats || {};
    var cs = a.cityStats   || {};
    var dTotal = (ds.mobile||0) + (ds.desktop||0) + (ds.tablet||0);
    var deviceHtml = '';
    if (dTotal > 0) {
        deviceHtml = '<span style="font-size:10px;color:#888;margin-right:6px;">' +
            (ds.desktop ? '🖥️ ' + ds.desktop + ' ' : '') +
            (ds.mobile  ? '📱 ' + ds.mobile  + ' ' : '') +
            (ds.tablet  ? '📟 ' + ds.tablet  + ' ' : '') +
            '</span>';
    }
    var topCities = Object.entries(cs).sort(function(a,b){return b[1]-a[1];}).slice(0,3);
    var cityHtml = topCities.length ?
        '<span style="font-size:10px;color:#888;">' +
        topCities.map(function(x){ return x[0]+' ('+x[1]+')'; }).join(' · ') +
        '</span>' : '';
    return deviceHtml + cityHtml;
}
function renderSessions(sessions) {
    var sesEl = document.getElementById("sessionList");
    if (!sesEl) return;

    if (!sessions || !sessions.length) {
        sesEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا سەردانێک تۆمار نەکراوە</div>';
        return;
    }

    // ---- هەموو سەردانەکان نیشان بدە — هەر reload جیاواز ----
    var uniqueSessions = sessions.slice().sort(function(a, b) {
        return new Date(b.time || b.start || 0) - new Date(a.time || a.start || 0);
    });

    var _sesPage = 0;
    var PAGE = 10;

    function buildSessionRows(list, offset) {
        return list.map(function(s, i) {
            var locParts = [];
            if (s.district && s.district !== "" && s.district !== "---") locParts.push(s.district);
            if (s.city && s.city !== "---" && s.city !== "") locParts.push(s.city);
            if (s.region && s.region !== "" && s.region !== "---") {
                var regionShort = s.region.replace(" Governorate","").replace(" Province","").replace(" Region","");
                if (regionShort !== s.city) locParts.push(regionShort);
            }
            if (s.country && s.country !== "---" && s.country !== "") locParts.push(s.country);

            var locHTML;
            if (locParts.length === 0) {
                if (s.ip && s.ip !== "") {
                    locHTML = '<span style="color:#f57c00;font-size:0.9em;"><i class="fas fa-shield-alt"></i> VPN / پڕۆکسی</span>';
                } else {
                    locHTML = '<span style="color:#bbb;font-size:0.9em;"><i class="fas fa-user-secret"></i> نەناسراو</span>';
                }
            } else {
                locHTML = '<i class="fas fa-map-marker-alt" style="color:#e53935;margin-left:4px;"></i>' + escHtml(locParts.join(" ← "));
            }
            var extra = "";
            if (s.isp) extra += '<div style="font-size:10px;color:#aaa;margin-top:2px;"><i class="fas fa-wifi"></i> ' + escHtml(s.isp) + '</div>';
            if (s.lat && s.lon) extra += '<a href="https://maps.google.com/?q='+s.lat+','+s.lon+'" target="_blank" style="font-size:10px;color:#42a5f5;"><i class="fas fa-map"></i> گووگڵ مەپ</a>';
            if (s.ip && s.ip !== "") extra += '<div style="font-size:10px;color:#ccc;margin-top:1px;direction:ltr;">IP: ' + escHtml(s.ip) + '</div>';
            var dt = new Date(s.time || s.start || "");
            var timeStr = dt.toLocaleDateString("ar-IQ") + " " + dt.toLocaleTimeString("ar-IQ", {hour:"2-digit",minute:"2-digit"});
            var deviceText = escHtml(s.device || "نەناسراو");
            return '<tr>' +
                '<td style="text-align:center;color:#aaa;">' + (offset + i + 1) + '</td>' +
                '<td style="font-size:12px;">' + timeStr + '</td>' +
                '<td><div style="font-size:13px;font-weight:500;">' + locHTML + '</div>' + extra + '</td>' +
                '<td style="font-size:12px;">' + deviceText + '</td>' +
                '</tr>';
        }).join("");
    }

    function renderSesPaged() {
        var shown = Math.min((_sesPage + 1) * PAGE, uniqueSessions.length);
        var tbody = document.getElementById("ses-tbody");
        if (tbody) tbody.innerHTML = buildSessionRows(uniqueSessions.slice(0, shown), 0);
        var moreBtn = document.getElementById("ses-more-btn");
        if (moreBtn) {
            if (shown < uniqueSessions.length) {
                moreBtn.style.display = "block";
                moreBtn.textContent = "نیشانی بدە (" + Math.min(PAGE, uniqueSessions.length - shown) + " ی تر)";
            } else {
                moreBtn.style.display = "none";
            }
        }
    }

    var rows = buildSessionRows(uniqueSessions.slice(0, PAGE), 0);

    // ---- ئاماری کۆمپیوتەر و موبایل ----
    var mobileCount = 0, desktopCount = 0, tabletCount = 0;
    uniqueSessions.forEach(function(s) {
        var d = s.device || "";
        if (d.includes("تابلێت") || d.includes("📟")) tabletCount++;
        else if (d.includes("موبایل") || d.includes("📱")) mobileCount++;
        else desktopCount++; // کۆمپیوتەر یان نەناسراو
    });
    var total = uniqueSessions.length || 1;
    var mobilePct   = Math.round(mobileCount  / total * 100);
    var desktopPct  = Math.round(desktopCount / total * 100);

    // ---- ئاماری شوێن ----
    var locCount = {};
    uniqueSessions.forEach(function(s) {
        if (s.city && s.city !== "---" && s.city !== "") {
            locCount[s.city] = (locCount[s.city] || 0) + 1;
        } else if (s.country && s.country !== "---") {
            locCount[s.country] = (locCount[s.country] || 0) + 1;
        } else {
            locCount["نەناسراو/VPN"] = (locCount["نەناسراو/VPN"] || 0) + 1;
        }
    });
    var sortedLoc = Object.entries(locCount).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var locBars = sortedLoc.map(function(lc) {
        var pct = Math.round(lc[1] / total * 100);
        return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
            '<div style="min-width:90px;font-size:11px;color:#555;text-align:right;">' + escHtml(lc[0]) + '</div>' +
            '<div style="flex:1;background:#eee;border-radius:4px;height:14px;overflow:hidden;">' +
            '<div style="width:'+pct+'%;height:100%;background:#42a5f5;border-radius:4px;"></div></div>' +
            '<div style="font-size:11px;color:#42a5f5;font-weight:bold;min-width:28px;">' + lc[1] + '</div>' +
            '</div>';
    }).join("");

    var summaryBar =
        '<div style="background:#f8faf8;border:1px solid #e0e0e0;border-radius:10px;padding:12px 14px;margin-bottom:12px;">' +
            '<div style="font-size:11px;color:#888;margin-bottom:8px;"><i class="fas fa-mobile-alt"></i> ئامێر</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">' +
            '<div style="text-align:center;background:#e8f5e9;border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:1.1em;font-weight:bold;color:#2e7d32;">🖥️ '+desktopCount+'</div>' +
            '<div style="font-size:10px;color:#888;">کۆمپیوتەر '+desktopPct+'%</div></div>' +
            '<div style="text-align:center;background:#e3f2fd;border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:1.1em;font-weight:bold;color:#1565c0;">📱 '+mobileCount+'</div>' +
            '<div style="font-size:10px;color:#888;">موبایل '+mobilePct+'%</div></div>' +
            (tabletCount > 0 ?
            '<div style="text-align:center;background:#fff3e0;border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:1.1em;font-weight:bold;color:#e65100;">📟 '+tabletCount+'</div>' +
            '<div style="font-size:10px;color:#888;">تابلێت '+Math.round(tabletCount/total*100)+'%</div></div>' : '') +
            '</div>' +
            '<div style="font-size:11px;color:#888;margin-bottom:8px;"><i class="fas fa-map-marker-alt"></i> زیاترین شوێنەکان</div>' +
            locBars +
        '</div>'

    sesEl.innerHTML = summaryBar +
        '<table class="stats-table">' +
        '<thead><tr><th>#</th><th>کات</th><th>شوێن</th><th>ئامێر</th></tr></thead>' +
        '<tbody id="ses-tbody">' + rows + '</tbody></table>' +
        (uniqueSessions.length > PAGE
            ? '<div style="text-align:center;margin-top:10px;">' +
              '<button id="ses-more-btn" class="add-btn" style="background:#e3f2fd;color:#1565c0;border:1px solid #bbdefb;">' +
              'نیشانی بدە (' + Math.min(PAGE, uniqueSessions.length - PAGE) + ' ی تر)</button></div>'
            : '');

    var moreBtn = document.getElementById("ses-more-btn");
    if (moreBtn) {
        moreBtn.addEventListener("click", function() {
            _sesPage++;
            renderSesPaged();
        });
    }
}


// ---- پری KV ----
function renderKvUsage(usage) {
    var el = document.getElementById("stat-kv-usage");
    if (!el) return;
    if (!usage) { el.textContent = "نادیاره"; return; }
    var pct  = usage.percent || 0;
    var used = usage.usedMB  || "?";
    var max  = usage.maxMB   || "?";
    el.textContent = used + " / " + max + " MB  (" + pct + "%)";
    var bar = document.getElementById("kv-usage-bar");
    if (bar) {
        bar.style.width = Math.min(pct, 100) + "%";
        bar.style.background = pct > 80 ? "#e53935" : pct > 50 ? "#fb8c00" : "var(--accent)";
    }
}

// ---- Textarea ئامارەکان ----
var _currentSnaps = [];
function renderSnapshots(snaps) {
    _currentSnaps = snaps || [];
    var el = document.getElementById("textareaList");
    if (!el) return;

    if (!snaps || !snaps.length) {
        el.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا دەقێک تۆمار نەکراوە ئەمرۆ</div>';
        return;
    }

    var _snapPage = 0;
    var SNAP_PAGE = 10;
    var _allSnaps = snaps || [];

    function buildSnapHtml(list) {
        var html = '<div class="snap-list">';
        list.forEach(function(s, i) {
            var uid     = "snap_" + i;
            var timeStr = "";
            try { timeStr = new Date(s.time).toLocaleTimeString(); } catch(e) {}
            var txt      = s.text || s.preview || "";
            var shortTxt = txt.length > 80 ? txt.substring(0, 80) + "…" : txt;

            html += '<div class="snap-row" id="' + uid + '_row">' +
                '<div class="snap-header">' +
                    '<span class="snap-label"><i class="fas fa-mouse-pointer"></i> ' + escHtml(s.label || "—") + '</span>' +
                    '<span class="snap-time"><i class="fas fa-clock"></i> ' + timeStr + '</span>' +
                    '<span class="snap-len">' + (txt.trim() ? txt.trim().split(/\s+/).length : 0) + ' وشە</span>' +
                    (txt.length > 0
                        ? '<button class="snap-toggle-btn" onclick="toggleSnap(\'' + uid + '\')">' +
                          '<i class="fas fa-chevron-down" id="' + uid + '_icon"></i> خوێندنەوە</button>'
                        : '<span style="color:#aaa;font-size:0.8em">— بۆشا —</span>') +
                '</div>' +
                (txt.length > 0
                    ? '<div class="snap-preview" id="' + uid + '_prev">' + escHtml(shortTxt) + '</div>' +
                      '<div class="snap-full" id="' + uid + '_full" style="display:none">' + escHtml(txt) + '</div>'
                    : '') +
            '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderSnapPaged() {
        var shown = Math.min((_snapPage + 1) * SNAP_PAGE, _allSnaps.length);
        var wrap  = document.getElementById("snap-list-wrap");
        if (wrap) wrap.innerHTML = buildSnapHtml(_allSnaps.slice(0, shown));
        var btn = document.getElementById("snap-more-btn");
        if (btn) {
            if (shown < _allSnaps.length) {
                btn.style.display = "block";
                btn.textContent = "نیشانی بدە (" + Math.min(SNAP_PAGE, _allSnaps.length - shown) + " ی تر)";
            } else {
                btn.style.display = "none";
            }
        }
    }

    el.innerHTML =
        '<div id="snap-list-wrap">' + buildSnapHtml(_allSnaps.slice(0, SNAP_PAGE)) + '</div>' +
        (_allSnaps.length > SNAP_PAGE
            ? '<div style="text-align:center;margin-top:10px;">' +
              '<button id="snap-more-btn" class="add-btn" style="background:#e3f2fd;color:#1565c0;border:1px solid #bbdefb;">' +
              'نیشانی بدە (' + Math.min(SNAP_PAGE, _allSnaps.length - SNAP_PAGE) + ' ی تر)</button></div>'
            : '');

    var snapMoreBtn = document.getElementById("snap-more-btn");
    if (snapMoreBtn) {
        snapMoreBtn.addEventListener("click", function() {
            _snapPage++;
            renderSnapPaged();
        });
    }
}


function deleteAllSnaps() {
    if (!_currentSnaps.length) { showToast("⚠️ هیچ دەقێک نییە", true); return; }
    if (!confirm("دڵنیایت لە سڕینەوەی هەموو " + _currentSnaps.length + " دەق؟")) return;
    fetch("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "snapshots_replace", snaps: [] })
    }).then(function() {
        _currentSnaps = [];
        renderSnapshots([]);
        showToast("✅ هەموو دەقەکان سڕایەوە");
    }).catch(function() { showToast("⚠️ هەڵە لە سڕینەوە", true); });
}

function toggleSnap(uid) {
    var prev = document.getElementById(uid + "_prev");
    var full = document.getElementById(uid + "_full");
    var icon = document.getElementById(uid + "_icon");
    var btn  = icon ? icon.closest("button") : null;
    if (!prev || !full) return;

    if (full.style.display === "none") {
        prev.style.display = "none";
        full.style.display = "block";
        if (icon) icon.className = "fas fa-chevron-up";
        if (btn)  btn.innerHTML  = '<i class="fas fa-chevron-up" id="' + uid + '_icon"></i> داخستن';
    } else {
        prev.style.display = "block";
        full.style.display = "none";
        if (icon) icon.className = "fas fa-chevron-down";
        if (btn)  btn.innerHTML  = '<i class="fas fa-chevron-down" id="' + uid + '_icon"></i> خوێندنەوە';
    }
}

function clearStats() {
    if (!confirm("دڵنیایت لە سڕینەوەی ئامارەکان؟\nئەمە تەنها لە پانێڵەکەدا پاکی دەکاتەوە — داتای KV ناگۆڕێت.")) return;
    showToast("⚠️ بۆ سڕینی داتای KV تکایە ڕاستەوخۆ لە داشبۆردی Cloudflare بیسڕەوە", true);
}

// ===========================
//  تاب ٥ — ئەرشیفی هەفتانە
// ===========================

function loadArchiveList() {
    var listEl = document.getElementById("archiveListContainer");
    if (!listEl) return;
    listEl.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> چاوەڕێ بکە...</div>';

    var base = "https://raw.githubusercontent.com/arkandara/arkandara.github.io/main/archives/";

    Promise.all([
        fetch(base + "daily_current.json").then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }),
        fetch(base + "weekly_index.json").then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }),
        fetch(base + "monthly_archive.json").then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }),
        fetch(base + "yearly_index.json").then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }),
        fetch("/track").then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; })
    ]).then(function(results) {
        var daily   = (results[0] && results[0].days) ? results[0].days.slice().reverse() : [];
        var weekly  = results[1] || [];
        var monthly = (results[2] && results[2].months) ? results[2].months.slice().reverse() : [];
        var yearly  = results[3] || [];
        var liveKV  = results[4] || {};

        // داتای ئەمرۆ لە KV — بە ستارەکەوە لە سەرەوە زیاد دەکرێت
        var todayStr = new Date().toISOString().slice(0,10);
        var todayClicks = Object.values(liveKV.clicks||{}).reduce(function(s,v){ return s+v; },0);
        var todayEntry = {
            date:        todayStr + " ★",
            totalVisits: liveKV.totalVisits || 0,
            totalClicks: todayClicks,
            isToday:     true
        };
        daily = [todayEntry].concat(daily.filter(function(d){ return (d.date||"").replace(" ★","") !== todayStr; }));

        if (!daily.length && !weekly.length && !monthly.length && !yearly.length) {
            listEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا ئەرشیفێک نییە</div>';
            return;
        }

        // ---- تابەکانی ئەرشیف ----
        var html = '<div class="arc-tabs">' +
            '<button class="arc-tab arc-tab-active" onclick="switchArcTab(this,\'arc-daily\')"><i class="fas fa-calendar-day"></i> رۆژانە ('+daily.length+')</button>' +
            '<button class="arc-tab" onclick="switchArcTab(this,\'arc-monthly\')"><i class="fas fa-calendar-alt"></i> مانگانە ('+monthly.length+')</button>' +
            '</div>';

        // ---- رۆژانە ----
        html += '<div id="arc-daily" class="arc-panel">';
        if (daily.length) {
            daily.forEach(function(a) {
                var isToday  = !!a.isToday;
                var rowClass = isToday ? 'archive-row archive-row-today' : 'archive-row';
                var dateClean = (a.date||"").replace(" ★","");
                var dp = dateClean.split("-");
                var dlabel = (dp[2]||"") + "/" + (dp[1]||"") + "/" + (dp[0]||"");
                var kurdishDays = ["یەکشەممە","دووشەممە","سێشەممە","چوارشەممە","پێنجشەممە","هەینی","شەممە"];
                var dayOfWeek = dateClean ? kurdishDays[new Date(dateClean).getDay()] : "";
                var todayBadge = isToday ? '<span class="today-badge">⚡ ئەمرۆ (زیندوو)</span>' : '';
                html += '<div class="'+rowClass+'" onclick="showArchiveChart(\'daily\','+JSON.stringify(a)+')" style="cursor:pointer">' +
                    '<div class="archive-week"><i class="fas fa-calendar-day"></i> ' + dlabel + ' ' + todayBadge + '<br><small style="opacity:0.7;font-size:0.82em">' + dayOfWeek + '</small></div>' +
                    '<div class="archive-meta">' +
                        '<span><i class="fas fa-globe"></i> '+(a.totalVisits||0)+' سەردان</span>' +
                        '<span><i class="fas fa-mouse-pointer"></i> '+(a.totalClicks||0)+' کلیک</span>' +
                        renderDeviceCityMeta(a) +
                    '</div>' +
                    '<div class="archive-btns">' +
                        (a.fileJson ? '<a href="'+base+a.fileJson.replace("archives/","")+'" target="_blank" class="archive-dl json" onclick="event.stopPropagation()">JSON</a>' : '') +
                        (a.fileCsv  ? '<a href="'+base+a.fileCsv.replace("archives/","")+'"  target="_blank" class="archive-dl csv"  onclick="event.stopPropagation()">CSV</a>'  : '') +
                    '</div>' +
                '</div>';
            });
        } else {
            html += '<div class="no-data">هێشتا ئەرشیفی رۆژانە نییە</div>';
        }
        html += '</div>';

   
        // ---- مانگانە ----
        html += '<div id="arc-monthly" class="arc-panel" style="display:none">';
        if (monthly.length) {
            monthly.forEach(function(a) {
                var mp = (a.month||"").split("-");
                var mNames = ["","کانوونی دووەم","شوبات","ئازار","نیسان","ئایار","حوزەیران","تەممووز","ئاب","ئەیلوول","تشرینی یەکەم","تشرینی دووەم","کانوونی یەکەم"];
                var mlabel = (mNames[+(mp[1]||0)]||mp[1]) + " " + (mp[0]||"");
                html += '<div class="archive-row" onclick="showArchiveChart(\'monthly\','+JSON.stringify(a)+')" style="cursor:pointer">' +
                    '<div class="archive-week"><i class="fas fa-calendar-alt"></i> ' + mlabel + '</div>' +
                    '<div class="archive-meta">' +
                        '<span><i class="fas fa-globe"></i> '+(a.totalVisits||0)+' سەردان</span>' +
                        '<span><i class="fas fa-mouse-pointer"></i> '+(a.totalClicks||0)+' کلیک</span>' +
                    '</div>' +
                '</div>';
            });
        } else {
            html += '<div class="no-data">هێشتا ئەرشیفی مانگانە نییە</div>';
        }
        html += '</div>';

        // ---- ساڵانه‌ ----
        html += '<div id="arc-yearly" class="arc-panel" style="display:none">';
        if (yearly.length) {
            yearly.forEach(function(a) {
                var ylabel = 'ساڵی ' + (a.year||"");
                html += '<div class="archive-row" onclick="showArchiveChart(\'yearly\',' + JSON.stringify(a) + ')" style="cursor:pointer">' +
                    '<div class="archive-week"><i class="fas fa-calendar"></i> ' + ylabel + '</div>' +
                    '<div class="archive-meta">' +
                        '<span><i class="fas fa-globe"></i> ' + (a.totalVisits||0) + ' سەردان</span>' +
                        '<span><i class="fas fa-mouse-pointer"></i> ' + (a.totalClicks||0) + ' كلیك</span>' +
                        '<span><i class="fas fa-calendar-alt"></i> ' + (a.months||[]).length + ' مانگ</span>' +
                    '</div>' +
                '</div>';
            });
        } else {
            html += '<div class="no-data">ئه‌رشیفی ساڵانه‌ نیه‌</div>';
        }
        html += '</div>';

        // ---- نەخشەی هەڵبژێردراو ----
        html += '<div id="arc-chart-area" style="display:none;margin-top:16px;">' +
            '<div class="card-header" style="margin-bottom:8px;">' +
                '<i class="fas fa-chart-bar"></i> <span id="arc-chart-title">نەخشە</span>' +
                '<button class="add-btn" onclick="document.getElementById(\'arc-chart-area\').style.display=\'none\'" style="margin-right:auto;background:#fce4e4;color:#c62828;">✕ داخستن</button>' +
            '</div>' +
            '<div id="arc-chart-inner"></div>' +
        '</div>';

        listEl.innerHTML = html;
    }).catch(function() {
        listEl.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> هەڵە لە بارکردنی ئەرشیفەکان</div>';
    });
}

function switchArcTab(btn, panelId) {
    document.querySelectorAll(".arc-tab").forEach(function(b){ b.classList.remove("arc-tab-active"); });
    document.querySelectorAll(".arc-panel").forEach(function(p){ p.style.display="none"; });
    btn.classList.add("arc-tab-active");
    var panel = document.getElementById(panelId);
    if (panel) panel.style.display = "block";
    document.getElementById("arc-chart-area").style.display = "none";
}

function showArchiveChart(type, item) {
    var area  = document.getElementById("arc-chart-area");
    var inner = document.getElementById("arc-chart-inner");
    var title = document.getElementById("arc-chart-title");
    if (!area || !inner) return;

    // بۆ رۆژانە — فایلی تەواوەکە بخوێنەوە بۆ کلیکەکان
    if (type === "daily") {
        var dp = (item.date||"").replace(" ★","").split("-");
        title.textContent = (dp[2]||"") + "/" + (dp[1]||"") + "/" + (dp[0]||"");
        area.style.display = "block";

        // ئەگەر داتا ڕاستەوخۆ لە item هەیە (daily_current) — بەبێ فەچ
        // ئەگەر fileJson هەیە، فایلی جیاوازەکە بخوێنەوە (ئەرشیفی کۆن)
        function renderDailyChart(data) {
                var clicks = data.clicks || {};
                var sorted = Object.entries(clicks).sort(function(a,b){ return b[1]-a[1]; }).slice(0,10);
                var maxC   = sorted.length ? sorted[0][1] : 1;

                var barsHTML = sorted.length ? sorted.map(function(kv){
                    var pct = Math.round((kv[1]/maxC)*100);
                    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
                        '<div style="min-width:110px;font-size:12px;color:var(--text-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+kv[0]+'">'+kv[0]+'</div>' +
                        '<div style="flex:1;background:var(--border);border-radius:4px;height:18px;overflow:hidden;">' +
                            '<div style="width:'+pct+'%;height:100%;background:#42a5f5;border-radius:4px;transition:width 0.4s;"></div>' +
                        '</div>' +
                        '<div style="min-width:28px;font-size:12px;font-weight:bold;color:#42a5f5;">'+kv[1]+'</div>' +
                    '</div>';
                }).join("") : '<div class="no-data">هیچ کلیکێک تۆمار نەکراوە</div>';

                inner.innerHTML =
                    '<div class="sc-summary">' +
                        '<span><i class="fas fa-globe"></i> سەردان: <strong>'+(data.totalVisits||0)+'</strong></span>' +
                        '<span><i class="fas fa-mouse-pointer"></i> کۆی کلیک: <strong>'+(Object.values(clicks).reduce(function(s,v){return s+v;},0))+'</strong></span>' +
                        '<span><i class="fas fa-keyboard"></i> دەق: <strong>'+(data.totalTextarea||0)+'</strong></span>' +
                    '</div>' +
                    renderDeviceCityMeta(data) +
                    (sorted.length ? '<div style="margin-top:10px;font-size:12px;color:var(--text-muted);margin-bottom:6px;">زۆرترین کلیکەکان:</div>' : '') +
                    barsHTML;
        }

        if (!item.fileJson) {
            // داتا ڕاستەوخۆ لە daily_current.json — بەبێ فەچ
            renderDailyChart(item);
        } else {
            // ئەرشیفی کۆن کە fileJson هەیە
            var base = "https://raw.githubusercontent.com/arkandara/arkandara.github.io/main/archives/";
            var jsonFile = item.fileJson.replace("archives/","");
            inner.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> بارکردن...</div>';
            fetch(base + jsonFile)
                .then(function(r){ return r.ok ? r.json() : null; })
                .then(function(data) {
                    if (!data) {
                        inner.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> فایلی ئەرشیف نییە</div>';
                        return;
                    }
                    renderDailyChart(data);
                })
                .catch(function(){
                    inner.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> هەڵە لە بارکردن</div>';
                });
        }
        area.scrollIntoView({behavior:"smooth",block:"nearest"});
        return;
    }

    // بۆ هەفتانە و مانگانە — نەخشەی ستون بۆ هەر رۆژ
    // ---- ساڕانۀ — نەخشەی ستون بۆ هەر مانگ ----
    if (type === "yearly") {
        title.textContent = 'ساڵی ' + (item.year||"");
        area.style.display = "block";
        var months = item.months || [];
        if (!months.length) {
            inner.innerHTML = '<div class="no-data">هیچ داتایەكی مانگانه‌ نیه‌</div>';
            area.scrollIntoView({behavior:"smooth",block:"nearest"});
            return;
        }
        var isDark=document.body.classList.contains("dark-mode");
        var gridClr=isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)";
        var axisClr=isDark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.15)";
        var numClr=isDark?"#777":"#aaa", lblClr=isDark?"#999":"#777";
        var mNames=["","كانوونی دووەم","شوبات","ئازار","نیسان","ئایار","حوزەیران","تەممووز","ئاب","ئەیلوول","تشرینی یەكەم","تشرینی دووەم","كانوونی یەكەم"];
        var maxV=Math.max.apply(null,months.map(function(m){return m.visits||0;}))||1;
        var maxC=Math.max.apply(null,months.map(function(m){return m.clicks||0;}))||1;
        var maxVal=Math.max(maxV,maxC);
        function niceMaxY(v){if(v<=5)return 5;if(v<=10)return 10;if(v<=20)return 20;if(v<=50)return 50;var mag=Math.pow(10,Math.floor(Math.log10(v)));return Math.ceil(v/mag)*mag;}
        var chartMax=niceMaxY(maxVal);
        var n=months.length,svgW=Math.max(n*60+60,400),svgH=200;
        var padL=42,padR=12,padT=16,padB=44;
        var chartH=svgH-padT-padB,chartW=svgW-padL-padR;
        var barW=Math.min(18,(chartW/n)-6),colW=chartW/n;
        var svg="";
        for(var g=0;g<=4;g++){
            var gVal=Math.round(chartMax*g/4);
            var gy=padT+chartH-Math.round(chartH*g/4);
            svg+='<line x1="'+padL+'" y1="'+gy+'" x2="'+(svgW-padR)+'" y2="'+gy+'" stroke="'+gridClr+'" stroke-width="1"/>';
            svg+='<text x="'+(padL-5)+'" y="'+(gy+4)+'" text-anchor="end" font-size="10" fill="'+numClr+'">'+gVal+'</text>';
        }
        months.forEach(function(m,i){
            var visits=m.visits||0,clicks=m.clicks||0;
            var cx=padL+i*colW+colW/2;
            var hV=Math.max(2,Math.round(chartH*visits/chartMax));
            var hC=Math.max(2,Math.round(chartH*clicks/chartMax));
            var yV=padT+chartH-hV,yC=padT+chartH-hC;
            svg+='<rect x="'+(cx-barW-1)+'" y="'+yV+'" width="'+barW+'" height="'+hV+'" rx="3" fill="#42a5f5" opacity="0.88"><title>سەردان: '+visits+'</title></rect>';
            svg+='<rect x="'+(cx+1)+'" y="'+yC+'" width="'+barW+'" height="'+hC+'" rx="3" fill="#4caf50" opacity="0.88"><title>كلیك: '+clicks+'</title></rect>';
            if(hV>14)svg+='<text x="'+(cx-barW/2-1)+'" y="'+(yV-3)+'" text-anchor="middle" font-size="9" fill="#42a5f5" font-weight="bold">'+visits+'</text>';
            if(hC>14)svg+='<text x="'+(cx+barW/2+1)+'" y="'+(yC-3)+'" text-anchor="middle" font-size="9" fill="#4caf50" font-weight="bold">'+clicks+'</text>';
            var mp=(m.month||"").split("-");
            var lbl=mNames[+(mp[1]||0)]||mp[1]||"";
            svg+='<text x="'+cx+'" y="'+(svgH-padB+14)+'" text-anchor="middle" font-size="9" fill="'+lblClr+'">'+lbl+'</text>';
        });
        svg+='<line x1="'+padL+'" y1="'+(padT+chartH)+'" x2="'+(svgW-padR)+'" y2="'+(padT+chartH)+'" stroke="'+axisClr+'" stroke-width="1.5"/>';
        var sumV=months.reduce(function(s,m){return s+(m.visits||0);},0);
        var sumC=months.reduce(function(s,m){return s+(m.clicks||0);},0);
        inner.innerHTML=
            '<div class="sc-summary">'+
              '<span><i class="fas fa-globe"></i> كۆی سەردان: <strong>'+sumV+'</strong></span>'+
              '<span><i class="fas fa-mouse-pointer"></i> كۆی كلیك: <strong>'+sumC+'</strong></span>'+
              '<span><i class="fas fa-calendar-alt"></i> مانگ: <strong>'+n+'</strong></span>'+
            '</div>'+
            '<div class="sc-chart-wrap"><svg width="'+svgW+'" height="'+svgH+'" xmlns="http://www.w3.org/2000/svg" style="display:block">'+svg+'</svg></div>'+
            '<div class="sc-legend"><span class="sc-leg-v"><span class="sc-dot" style="background:#42a5f5"></span>سەردان</span><span class="sc-leg-c"><span class="sc-dot" style="background:#4caf50"></span>كلیك</span></div>';
        area.scrollIntoView({behavior:"smooth",block:"nearest"});
        return;
    }

    // مانگانە: مانگی تەواوبوو = تەنها کۆی ئامار، مانگی ئێستا = چارتی رۆژانە
    var mp = (item.month||"").split("-");
    var mNames = ["","کانوونی دووەم","شوبات","ئازار","نیسان","ئایار","حوزەیران","تەممووز","ئاب","ئەیلوول","تشرینی یەکەم","تشرینی دووەم","کانوونی یەکەم"];
    title.textContent = (mNames[+(mp[1]||0)]||mp[1]) + " " + (mp[0]||"");

    var thisMonth = new Date().toISOString().slice(0,7);
    var isCurrentMonth = (item.month === thisMonth);

    if (!isCurrentMonth) {
        // مانگی تەواوبوو — تەنها کۆی ئامار پیشاندەدرێت
        inner.innerHTML =
            '<div class="sc-summary">' +
              '<span><i class="fas fa-globe"></i> کۆی سەردان: <strong>'+(item.totalVisits||0)+'</strong></span>' +
              '<span><i class="fas fa-mouse-pointer"></i> کۆی کلیک: <strong>'+(item.totalClicks||0)+'</strong></span>' +
            '</div>' +
            renderDeviceCityMeta(item);
        area.style.display = "block";
        area.scrollIntoView({behavior:"smooth",block:"nearest"});
        return;
    }

    // مانگی ئێستا — چارتی رۆژانە لە daily_current.json
    var base2 = "https://raw.githubusercontent.com/arkandara/arkandara.github.io/main/archives/";
    inner.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> بارکردن...</div>';
    fetch(base2 + "daily_current.json")
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(cur) {
            var days = (cur && cur.days) ? cur.days : [];
            if (!days.length) {
                inner.innerHTML = '<div class="no-data">هیچ داتایەک نییە بۆ مانگی ئێستا</div>';
                return;
            }
            function niceMax(v) {
                if (v<=5) return 5; if (v<=10) return 10; if (v<=20) return 20; if (v<=50) return 50;
                var mag = Math.pow(10, Math.floor(Math.log10(v)));
                return Math.ceil(v/mag)*mag;
            }
            var maxV = Math.max.apply(null, days.map(function(d){ return d.totalVisits||0; })) || 1;
            var maxC = Math.max.apply(null, days.map(function(d){ return d.totalClicks||0; })) || 1;
            var chartMax = niceMax(Math.max(maxV, maxC));
            var n=days.length, svgW=Math.max(n*44+60,400), svgH=200;
            var padL=42,padR=12,padT=16,padB=44;
            var chartH=svgH-padT-padB, chartW=svgW-padL-padR;
            var barW=Math.min(13,(chartW/n)-5), colW=chartW/n;
            var isDark=document.body.classList.contains("dark-mode");
            var gridClr=isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)";
            var axisClr=isDark?"rgba(255,255,255,0.18)":"rgba(0,0,0,0.15)";
            var numClr=isDark?"#777":"#aaa", lblClr=isDark?"#999":"#777";
            var svg="";
            for (var g=0;g<=4;g++) {
                var gVal=Math.round(chartMax*g/4);
                var gy=padT+chartH-Math.round(chartH*g/4);
                svg+='<line x1="'+padL+'" y1="'+gy+'" x2="'+(svgW-padR)+'" y2="'+gy+'" stroke="'+gridClr+'" stroke-width="1"/>';
                svg+='<text x="'+(padL-5)+'" y="'+(gy+4)+'" text-anchor="end" font-size="10" fill="'+numClr+'">'+gVal+'</text>';
            }
            days.forEach(function(d,i) {
                var visits=d.totalVisits||0, clicks=d.totalClicks||0;
                var cx=padL+i*colW+colW/2;
                var hV=Math.max(2,Math.round(chartH*visits/chartMax));
                var hC=Math.max(2,Math.round(chartH*clicks/chartMax));
                var yV=padT+chartH-hV, yC=padT+chartH-hC;
                svg+='<rect x="'+(cx-barW-1)+'" y="'+yV+'" width="'+barW+'" height="'+hV+'" rx="3" fill="#42a5f5" opacity="0.88"><title>سەردان: '+visits+'</title></rect>';
                svg+='<rect x="'+(cx+1)+'" y="'+yC+'" width="'+barW+'" height="'+hC+'" rx="3" fill="#4caf50" opacity="0.88"><title>کلیک: '+clicks+'</title></rect>';
                if (hV>14) svg+='<text x="'+(cx-barW/2-1)+'" y="'+(yV-3)+'" text-anchor="middle" font-size="9" fill="#42a5f5" font-weight="bold">'+visits+'</text>';
                if (hC>14) svg+='<text x="'+(cx+barW/2+1)+'" y="'+(yC-3)+'" text-anchor="middle" font-size="9" fill="#4caf50" font-weight="bold">'+clicks+'</text>';
                var dp=(d.date||"").split("-");
                var lbl=(dp[2]||"")+"/"+(dp[1]||"");
                svg+='<text x="'+cx+'" y="'+(svgH-padB+14)+'" text-anchor="middle" font-size="10" fill="'+lblClr+'">'+lbl+'</text>';
            });
            svg+='<line x1="'+padL+'" y1="'+(padT+chartH)+'" x2="'+(svgW-padR)+'" y2="'+(padT+chartH)+'" stroke="'+axisClr+'" stroke-width="1.5"/>';
            var sumV=days.reduce(function(s,d){return s+(d.totalVisits||0);},0);
            var sumC=days.reduce(function(s,d){return s+(d.totalClicks||0);},0);
            inner.innerHTML =
                '<div class="sc-summary">' +
                  '<span><i class="fas fa-globe"></i> کۆی سەردان: <strong>'+sumV+'</strong></span>' +
                  '<span><i class="fas fa-mouse-pointer"></i> کۆی کلیک: <strong>'+sumC+'</strong></span>' +
                  '<span style="font-size:11px;opacity:0.7"><i class="fas fa-info-circle"></i> مانگی ئێستا — هێشتا تەواو نەبووە</span>' +
                '</div>' +
                '<div class="sc-chart-wrap"><svg width="'+svgW+'" height="'+svgH+'" xmlns="http://www.w3.org/2000/svg" style="display:block">'+svg+'</svg></div>' +
                '<div class="sc-legend"><span class="sc-leg-v"><span class="sc-dot" style="background:#42a5f5"></span>سەردان</span><span class="sc-leg-c"><span class="sc-dot" style="background:#4caf50"></span>کلیک</span></div>';
        })
        .catch(function() {
            inner.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> هەڵە لە بارکردن</div>';
        });
    area.style.display = "block";
    area.scrollIntoView({behavior:"smooth",block:"nearest"});
}

// ===========================
//  تاب ٦ — گۆڕینی پاسوۆرد
// ===========================

async function changePassword() {
    var msgEl = document.getElementById("passMsg");
    var oldPass = document.getElementById("oldPass").value;
    var newPass = document.getElementById("newPass").value;
    var confirmPass = document.getElementById("confirmPass").value;

    function showMsg(text, isError) {
        msgEl.className = isError ? "pass-error" : "pass-success";
        msgEl.innerHTML = (isError ? '<i class="fas fa-times-circle"></i> ' : '<i class="fas fa-check-circle"></i> ') + text;
        msgEl.style.display = "block";
    }

    if (!oldPass || !newPass || !confirmPass) {
        showMsg("تکایە هەموو خانەکان پڕ بکەرەوە", true);
        return;
    }
    if (newPass !== confirmPass) {
        showMsg("پاسوۆردی نوێ و دووبارەکردنەوەکەی یەک ناگرنەوە", true);
        return;
    }
    if (newPass.length < 8) {
        showMsg("پاسوۆردی نوێ دەبێت کەمترین ٨ پیت بێت", true);
        return;
    }
    var hasUpper = /[A-Z]/.test(newPass);
    var hasLower = /[a-z]/.test(newPass);
    var hasDigit = /[0-9]/.test(newPass);
    var hasSpecial = /[^A-Za-z0-9]/.test(newPass);
    var strength = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    if (strength < 3) {
        showMsg("پاسوۆردی نوێ پێویستە کەمترین ٣ جۆر لەم ٤ەوە تێدا بێت: پیت گەورە، پیت بچووک، ژمارە، نیشانەی تایبەت", true);
        return;
    }

    var oldHash = await hashPassword(oldPass);
    var newHash = await hashPassword(newPass);

    try {
        var res = await fetch("/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "admin_pass_set", oldHash: oldHash, newHash: newHash })
        });
        var data = await res.json();
        if (!res.ok || data.error) {
            showMsg(data.error || "هەڵەیەک روویدا", true);
            document.getElementById("oldPass").value = "";
            return;
        }
        document.getElementById("oldPass").value = "";
        document.getElementById("newPass").value = "";
        document.getElementById("confirmPass").value = "";
        showMsg("پاسوۆرد بە سەرکەوتوویی گۆڕدرا — لە هەر شوێنێکەوە کارئەکات ✓", false);
    } catch(e) {
        showMsg("هەڵەی تۆڕ — دووبارە هەوڵ بدەرەوە", true);
    }
}

// ===========================
//  یارمەتیدەرەکان
// ===========================

// ---- سفرکردنەوەی دەستی ئامارەکان ----
function manualClearStats() {
    if (!confirm("دڵنیایت لە سفرکردنەوەی ئامارەکان؟\nئامارەی کلیک و سەردان دەمێننەوە — تەنها دەقەکان دەسڕێنەوە.")) return;
    // تەنها snapshot ەکانی ئەمرۆ بسڕەوە
    fetch("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "snapshots_replace", snaps: [] })
    }).then(function() {
        _currentSnaps = [];
        renderSnapshots([]);
        showToast("✅ دەقەکانی ئەمرۆ سڕایەوە");
    }).catch(function() { showToast("⚠️ هەڵە لە سفرکردنەوە", true); });
}



function setEl(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

function showToast(msg, isError) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "toast" + (isError ? " error" : "");
    toast.classList.add("show");
    setTimeout(function() { toast.classList.remove("show"); }, 3500);
}

function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


// ===========================
//  تابی بینینی دەقی سایت
// ===========================

function loadPreviewText() {
    var el   = document.getElementById("previewTextContent");
    var time = document.getElementById("previewTextTime");
    if (!el) return;

    el.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> چاوەڕێ بکە...</div>';

    // داتا لە Cloudflare KV بخوێنەوە
    fetch("/track")
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var p = data.preview;
            if (!p || !p.text) {
                el.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا دەقێک نەنێردراوە لە سایتەکەوە</div>';
                if (time) time.textContent = "";
                return;
            }
            el.style.direction   = "rtl";
            el.style.textAlign   = "right";
            el.style.whiteSpace  = "pre-wrap";
            el.style.lineHeight  = "2";
            el.style.fontSize    = "1em";
            el.style.padding     = "8px 4px";
            el.textContent = p.text;
            if (time && p.time) {
                try { time.textContent = "کات: " + new Date(p.time).toLocaleString(); }
                catch(e) { time.textContent = p.time; }
            }
        })
        .catch(function() {
            el.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> هەڵە لە بارکردن</div>';
        });
}

function clearPreviewText() {
    if (!confirm("دڵنیایت لە سڕینەوەی دەقەکە؟")) return;
    // سڕینەوە لە KV
    fetch("/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "preview", text: " ", time: "" })
    }).then(function() {
        loadPreviewText();
        showToast("✅ دەقەکە سڕایەوە");
    });
}

// ---- پشاندانی پانێل ئەگەر پێشتر لۆگین کراوە ----
window.addEventListener("DOMContentLoaded", function() {
    if (sessionStorage.getItem("adminAuth") === "1") {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";
        if (window.innerWidth > 768) {
            document.getElementById("sidebar").classList.add("open");
        }
        initPanel();
    }
});

// ===========================
//  نمودارەکانی رۆژانە / هەفتانە / مانگانە
// ===========================

var _archiveIndex = null;
var _weeklyIndex  = null;
var _monthlyIndex = null;
var _yearlyIndex  = null;
var _statsPeriod  = "daily";

function renderYearlyView(selectedYear) {
    var wrap = document.getElementById("statsChartsWrap");
    if (!wrap) return;

    var years = _yearlyIndex || [];

    // ئەگەر ساڵی ئێستا لە yearly_index نییە، لە monthly_archive دروستی دەکەین
    var currentYear = String(new Date().getFullYear());
    var hasCurrentYear = years.some(function(y){ return y.year === currentYear; });
    var allYears = years.slice();
    if (!hasCurrentYear && (_monthlyIndex||[]).length) {
        var cyMonths = (_monthlyIndex||[]).filter(function(m){
            return (m.period||m.month||"").startsWith(currentYear);
        });
        if (cyMonths.length) {
            var cyVisits = cyMonths.reduce(function(s,m){ return s+(m.totalVisits||0); }, 0);
            var cyClicks = cyMonths.reduce(function(s,m){ return s+(m.totalClicks||0); }, 0);
            allYears = [{ year: currentYear, totalVisits: cyVisits, totalClicks: cyClicks, months: cyMonths, _live: true }].concat(allYears);
        }
    }

    if (!allYears.length) {
        wrap.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا داتایەک نییە</div>';
        return;
    }

    if (selectedYear) {
        var yEntry = allYears.find(function(y){ return y.year === selectedYear; });
        if (!yEntry) return;
        var months = yEntry.months || [];
        if (!months.length) {
            wrap.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هیچ مانگێک بۆ ' + selectedYear + ' نەدۆزراوەتەوە</div>';
            return;
        }
        var isDark = document.body.classList.contains("dark-mode");
        var gridClr = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
        var axisClr = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
        var numClr  = isDark ? "#777" : "#aaa";
        var lblClr  = isDark ? "#999" : "#777";
        var sumV = months.reduce(function(s,m){ return s+(m.totalVisits||m.visits||0); }, 0);
        var sumC = months.reduce(function(s,m){ return s+(m.totalClicks||m.clicks||0); }, 0);
        var maxV = Math.max.apply(null, months.map(function(m){ return m.totalVisits||m.visits||0; })) || 1;
        var maxC = Math.max.apply(null, months.map(function(m){ return m.totalClicks||m.clicks||0; })) || 1;
        var chartMax = Math.max(maxV, maxC);
        function niceMax(v){ if(v<=5)return 5;if(v<=10)return 10;if(v<=20)return 20;if(v<=50)return 50;var mag=Math.pow(10,Math.floor(Math.log10(v)));return Math.ceil(v/mag)*mag; }
        chartMax = niceMax(chartMax);
        var n = months.length;
        var svgW = Math.max(n * 55 + 60, 400);
        var svgH = 214, padL=42, padR=12, padT=16, padB=58;
        var chartH = svgH-padT-padB, chartW = svgW-padL-padR;
        var barW = Math.min(16, (chartW/n)-6), colW = chartW/n;
        var GRID = 4, svg = "";
        var kurdishMonths = ["","کانوونی دووەم","شوبات","ئازار","نیسان","ئایار","حوزەیران","تەممووز","ئاب","ئەیلوول","تشرینی یەکەم","تشرینی دووەم","کانوونی یەکەم"];
        for(var g=0;g<=GRID;g++){
            var gVal=Math.round(chartMax*g/GRID);
            var gy=padT+chartH-Math.round(chartH*g/GRID);
            svg+='<line x1="'+padL+'" y1="'+gy+'" x2="'+(svgW-padR)+'" y2="'+gy+'" stroke="'+gridClr+'" stroke-width="1"/>';
            svg+='<text x="'+(padL-5)+'" y="'+(gy+4)+'" text-anchor="end" font-size="10" fill="'+numClr+'">'+gVal+'</text>';
        }
        months.forEach(function(m, i){
            var visits = m.totalVisits||m.visits||0;
            var clicks = m.totalClicks||m.clicks||0;
            var cx = padL + i*colW + colW/2;
            var hV = Math.max(2, Math.round(chartH*visits/chartMax));
            var hC = Math.max(2, Math.round(chartH*clicks/chartMax));
            var yV = padT+chartH-hV, yC = padT+chartH-hC;
            svg+='<rect x="'+(cx-barW-1)+'" y="'+yV+'" width="'+barW+'" height="'+hV+'" rx="3" fill="#42a5f5" opacity="0.88"><title>سەردان: '+visits+'</title></rect>';
            svg+='<rect x="'+(cx+1)+'" y="'+yC+'" width="'+barW+'" height="'+hC+'" rx="3" fill="#4caf50" opacity="0.88"><title>کلیک: '+clicks+'</title></rect>';
            if(hV>14) svg+='<text x="'+(cx-barW/2-1)+'" y="'+(yV-3)+'" text-anchor="middle" font-size="9" fill="#42a5f5" font-weight="bold">'+visits+'</text>';
            if(hC>14) svg+='<text x="'+(cx+barW/2+1)+'" y="'+(yC-3)+'" text-anchor="middle" font-size="9" fill="#4caf50" font-weight="bold">'+clicks+'</text>';
            var mp = (m.period||m.month||"").split("-");
            var mNum = +(mp[1]||0);
            var lbl = kurdishMonths[mNum] || (mp[1]||"");
            svg+='<text x="'+cx+'" y="'+(svgH-padB+14)+'" text-anchor="middle" font-size="9" fill="'+lblClr+'">'+lbl+'</text>';
        });
        svg+='<line x1="'+padL+'" y1="'+(padT+chartH)+'" x2="'+(svgW-padR)+'" y2="'+(padT+chartH)+'" stroke="'+axisClr+'" stroke-width="1.5"/>';
        wrap.innerHTML =
            '<div style="margin-bottom:8px;display:flex;align-items:center;gap:10px">' +
              '<button onclick="renderYearlyView()" class="add-btn" style="font-size:12px;padding:4px 12px">← بەربێدەوە</button>' +
              '<strong>' + selectedYear + '</strong>' +
            '</div>' +
            '<div class="sc-summary">' +
              '<span><i class="fas fa-globe"></i> کۆی سەردان: <strong>'+sumV+'</strong></span>' +
              '<span><i class="fas fa-mouse-pointer"></i> کۆی کلیک: <strong>'+sumC+'</strong></span>' +
              '<span><i class="fas fa-calendar-alt"></i> ژمارەی مانگ: <strong>'+n+'</strong></span>' +
            '</div>' +
            '<div class="sc-chart-wrap"><svg width="'+svgW+'" height="'+svgH+'" xmlns="http://www.w3.org/2000/svg" style="display:block">'+svg+'</svg></div>' +
            '<div class="sc-legend">' +
              '<span class="sc-leg-v"><span class="sc-dot" style="background:#42a5f5"></span> سەردان</span>' +
              '<span class="sc-leg-c"><span class="sc-dot" style="background:#4caf50"></span> کلیک</span>' +
            '</div>';
        return;
    }

    // نیشاندانی لیستی ساڵەکان
    var isDark2 = document.body.classList.contains("dark-mode");
    var totalV = allYears.reduce(function(s,y){return s+(y.totalVisits||0);},0);
    var totalC = allYears.reduce(function(s,y){return s+(y.totalClicks||0);},0);
    var html = '<div class="sc-summary">' +
        '<span><i class="fas fa-calendar"></i> ژمارەی ساڵ: <strong>'+allYears.length+'</strong></span>' +
        '<span><i class="fas fa-globe"></i> کۆی سەردان: <strong>'+totalV+'</strong></span>' +
        '<span><i class="fas fa-mouse-pointer"></i> کۆی کلیک: <strong>'+totalC+'</strong></span>' +
    '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">';
    allYears.forEach(function(y){
        var mCount = (y.months||[]).length;
        var badge = y._live ? ' <span style="font-size:10px;background:#fff3cd;color:#856404;padding:1px 6px;border-radius:8px;margin-right:4px">جاری</span>' : '';
        var rowBg = isDark2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
        var rowBorder = isDark2 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
        html += '<div onclick="renderYearlyView(\'' + y.year + '\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-radius:10px;background:' + rowBg + ';border:1px solid ' + rowBorder + ';">' +
            '<span style="font-size:1.1em;font-weight:bold"><i class="fas fa-calendar" style="color:#42a5f5;margin-left:6px"></i>'+y.year+badge+'</span>' +
            '<span style="display:flex;gap:16px;font-size:0.9em;opacity:0.8">' +
                '<span><i class="fas fa-globe" style="color:#42a5f5"></i> '+(y.totalVisits||0)+'</span>' +
                '<span><i class="fas fa-mouse-pointer" style="color:#4caf50"></i> '+(y.totalClicks||0)+'</span>' +
                '<span><i class="fas fa-calendar-alt" style="color:#888"></i> '+mCount+' مانگ</span>' +
            '</span>' +
            '<i class="fas fa-chevron-left" style="opacity:0.4"></i>' +
        '</div>';
    });
    html += '</div>';
    wrap.innerHTML = html;
}

function loadStatsCharts() {
    var wrap = document.getElementById("statsChartsWrap");
    if (!wrap) return;
    wrap.innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i> چاوەڕێ بکە...</div>';

    var base = "https://raw.githubusercontent.com/arkandara/arkandara.github.io/main/archives/";

    Promise.all([
        fetch(base + "daily_current.json").then(function(r){ return r.ok?r.json():{}; }).catch(function(){ return {}; }),
        fetch(base + "weekly_index.json").then(function(r){ return r.ok?r.json():[]; }).catch(function(){ return []; }),
        fetch(base + "monthly_archive.json").then(function(r){ return r.ok?r.json():{months:[]}; }).catch(function(){ return {months:[]}; }),
        fetch(base + "yearly_index.json").then(function(r){ return r.ok?r.json():[]; }).catch(function(){ return []; }),
        fetch("/track").then(function(r){ return r.ok?r.json():{}; }).catch(function(){ return {}; })
    ]).then(function(results) {
        var archived = (results[0] && results[0].days) ? results[0].days.slice().reverse() : [];
        _weeklyIndex  = results[1];
        _monthlyIndex = (results[2] && results[2].months) ? results[2].months.slice().reverse() : [];
        _yearlyIndex  = results[3];
        var kv        = results[4] || {};

        // داتای ئەمرۆ لە KV — وەک ڕیزی یەکەم زیاد دەکرێت
        var todayStr = new Date().toISOString().slice(0,10);
        var todayEntry = {
            date:        todayStr + " ★",  // ئەمرۆ
            totalVisits: kv.totalVisits  || 0,
            totalClicks: Object.values(kv.clicks||{}).reduce(function(s,v){ return s+v; }, 0),
            _isToday:    true
        };

        // سڕینەوەی ئەگەر ئەمرۆ پێشتر لە ئەرشیفدا بوو
        var filtered = archived.filter(function(d){ return d.date !== todayStr; });
        _archiveIndex = [todayEntry].concat(filtered);

        renderStatsPeriod(_statsPeriod);
    }).catch(function() {
        if(wrap) wrap.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> هەڵە لە بارکردنی ئامارەکان</div>';
    });
}

function renderStatsPeriod(period) {
    _statsPeriod = period;
    ["btn-daily","btn-weekly","btn-monthly","btn-yearly"].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove("stats-period-active");
    });
    var activeBtn = document.getElementById("btn-" + period);
    if (activeBtn) activeBtn.classList.add("stats-period-active");

    var wrap = document.getElementById("statsChartsWrap");
    if (!wrap) return;

    var data, labelKey;
    if (period === "daily") {
        data = (_archiveIndex||[]).slice(0,30).reverse();
        labelKey = "date";
    } else if (period === "weekly") {
        data = (_weeklyIndex||[]).slice(0,12).reverse();
        labelKey = "week";
    } else if (period === "yearly") {
        renderYearlyView();
        return;
    } else {
        data = (_monthlyIndex||[]).slice(0,12).reverse();
        labelKey = "month";
    }

    if (!data.length) {
        wrap.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا داتایەک نییە</div>';
        return;
    }

    // کۆی گشتی لە هەموو ئەرشیفکراوەکان — نەک تەنها ئەوەی لە چارتەکەدا دیاردەکرێت
    var _fullIndex = (period === "daily") ? (_archiveIndex||[])
                   : (period === "weekly") ? (_weeklyIndex||[])
                   : (period === "yearly") ? (_yearlyIndex||[])
                   : (_monthlyIndex||[]);
    var sumVisits = _fullIndex.reduce(function(s,d){ return s+(d.totalVisits||0); },0);
    var sumClicks = _fullIndex.reduce(function(s,d){ return s+(d.totalClicks||0); },0);
    var _fullN    = _fullIndex.length || 1;
    var maxV = Math.max.apply(null, data.map(function(d){ return d.totalVisits||0; })) || 1;
    var maxC = Math.max.apply(null, data.map(function(d){ return d.totalClicks||0; })) || 1;
    var maxVal = Math.max(maxV, maxC);

    function niceMax(v) {
        if (v <= 5)  return 5;
        if (v <= 10) return 10;
        if (v <= 20) return 20;
        if (v <= 50) return 50;
        var mag = Math.pow(10, Math.floor(Math.log10(v)));
        return Math.ceil(v / mag) * mag;
    }
    var chartMax = niceMax(maxVal);

    var n    = data.length;
    var svgW = Math.max(n * 44 + 60, 400);
    var svgH = 214;
    var padL = 42;
    var padR = 12;
    var padT = 16;
    var padB = 58;
    var chartH = svgH - padT - padB;
    var chartW = svgW - padL - padR;
    var barW   = Math.min(13, (chartW / n) - 5);
    var colW   = chartW / n;
    var isDark = document.body.classList.contains("dark-mode");
    var gridClr = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    var axisClr = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
    var numClr  = isDark ? "#777" : "#aaa";
    var lblClr  = isDark ? "#999" : "#777";

    var svg = "";
    var GRID = 4;

    // خەتەکانی ئاسۆیی و ژمارەی لای چەپ
    for (var g = 0; g <= GRID; g++) {
        var gVal = Math.round(chartMax * g / GRID);
        var gy   = padT + chartH - Math.round(chartH * g / GRID);
        svg += '<line x1="'+padL+'" y1="'+gy+'" x2="'+(svgW-padR)+'" y2="'+gy+'" stroke="'+gridClr+'" stroke-width="1"/>';
        svg += '<text x="'+(padL-5)+'" y="'+(gy+4)+'" text-anchor="end" font-size="10" fill="'+numClr+'">'+gVal+'</text>';
    }

    // ستونەکان
    data.forEach(function(d, i) {
        var visits = d.totalVisits || 0;
        var clicks = d.totalClicks || 0;
        var cx = padL + i * colW + colW / 2;

        var hV = Math.max(2, Math.round(chartH * visits / chartMax));
        var hC = Math.max(2, Math.round(chartH * clicks / chartMax));
        var yV = padT + chartH - hV;
        var yC = padT + chartH - hC;

        svg += '<rect x="'+(cx-barW-1)+'" y="'+yV+'" width="'+barW+'" height="'+hV+'" rx="3" fill="#42a5f5" opacity="0.88"><title>سەردان: '+visits+'</title></rect>';
        svg += '<rect x="'+(cx+1)+'" y="'+yC+'" width="'+barW+'" height="'+hC+'" rx="3" fill="#4caf50" opacity="0.88"><title>کلیک: '+clicks+'</title></rect>';

        if (hV > 14) svg += '<text x="'+(cx-barW/2-1)+'" y="'+(yV-3)+'" text-anchor="middle" font-size="9" fill="#42a5f5" font-weight="bold">'+visits+'</text>';
        if (hC > 14) svg += '<text x="'+(cx+barW/2+1)+'" y="'+(yC-3)+'" text-anchor="middle" font-size="9" fill="#4caf50" font-weight="bold">'+clicks+'</text>';

        // بەروار
        var raw = d[labelKey] || "";
        var lbl = "";
        if (period === "daily") {
            var p = raw.replace(" ★","").split("-");
            var kurdishDaysS = ["یەکشەممە","دووشەممە","سێشەممە","چوارشەممە","پێنجشەممە","هەینی","شەممە"];
            var rawClean = raw.replace(" ★","");
            var dayNameS = rawClean ? kurdishDaysS[new Date(rawClean).getDay()] : "";
            lbl = (p[2]||"") + "/" + (p[1]||"");
            svg += '<text x="'+cx+'" y="'+(svgH-padB+26)+'" text-anchor="middle" font-size="9" fill="'+lblClr+'" opacity="0.75">'+dayNameS+'</text>';
        } else if (period === "weekly") {
            var ws = (raw.split("_")[0]||"").split("-");
            var we = (raw.split("_")[1]||"").split("-");
            lbl = (ws[2]||"") + "-" + (we[2]||"") + "/" + (we[1]||"");
        } else {
            var mp = raw.split("-");
            var mn = ["","١","٢","٣","٤","٥","٦","٧","٨","٩","١٠","١١","١٢"];
            lbl = mn[+(mp[1]||0)] + "/" + (mp[0]||"").slice(2);
        }
        svg += '<text x="'+cx+'" y="'+(svgH-padB+14)+'" text-anchor="middle" font-size="10" fill="'+lblClr+'">'+lbl+'</text>';
    });

    // خەتی بنەوە
    svg += '<line x1="'+padL+'" y1="'+(padT+chartH)+'" x2="'+(svgW-padR)+'" y2="'+(padT+chartH)+'" stroke="'+axisClr+'" stroke-width="1.5"/>';

    var fullSVG = '<svg width="'+svgW+'" height="'+svgH+'" xmlns="http://www.w3.org/2000/svg" style="display:block">'+svg+'</svg>';

    wrap.innerHTML =
        '<div class="sc-summary">' +
          '<span><i class="fas fa-globe"></i> کۆی سەردان: <strong>'+sumVisits+'</strong></span>' +
          '<span><i class="fas fa-mouse-pointer"></i> کۆی کلیک: <strong>'+sumClicks+'</strong></span>' +
          '<span><i class="fas fa-chart-line"></i> تێکرا/رۆژ: <strong>'+Math.round(sumVisits/(_fullN||1))+'</strong></span>' +
        '</div>' +
        '<div class="sc-chart-wrap">'+fullSVG+'</div>' +
        '<div class="sc-legend">' +
          '<span class="sc-leg-v"><span class="sc-dot" style="background:#42a5f5"></span> سەردان</span>' +
          '<span class="sc-leg-c"><span class="sc-dot" style="background:#4caf50"></span> کلیک</span>' +
        '</div>';
}
