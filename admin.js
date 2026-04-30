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
    if (id === "tab-stats")   loadStats();
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

function loadButtons() {
    fetch("/track")
        .then(function(r) { return r.json(); })
        .then(function(d) {
            var btns = (d.settings && d.settings.toolbarBtns) ? d.settings.toolbarBtns : BTN_DEFAULTS;
            var list = document.getElementById("btnList");
            if (list) { list.innerHTML = ""; btns.forEach(function(b) { addBtnRow(b.label, b.color, b.action, b.group, b.fixed); }); }
        })
        .catch(function() {
            var list = document.getElementById("btnList");
            if (list) { list.innerHTML = ""; BTN_DEFAULTS.forEach(function(b) { addBtnRow(b.label, b.color, b.action, b.group, b.fixed); }); }
        });
}

function addBtnRow(label, color, action, group, fixed) {
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
        if (label) btns.push({ label: label, color: color, action: action, group: group, fixed: fixed });
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

function renderSessions(sessions) {
    var sesEl = document.getElementById("sessionList");
    if (!sesEl) return;

    if (!sessions || !sessions.length) {
        sesEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا سەردانێک تۆمار نەکراوە</div>';
        return;
    }

    var rows = sessions.slice(0, 15).map(function(s, i) {
        var loc = "";
        if (s.city    && s.city    !== "---") loc += s.city;
        if (s.city    && s.country && s.city !== "---" && s.country !== "---") loc += "، ";
        if (s.country && s.country !== "---") loc += s.country;
        if (!loc) loc = "نەناسراو";
        var region = s.region ? ' <span style="color:#aaa;font-size:0.85em;">(' + escHtml(s.region) + ')</span>' : "";
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + new Date(s.time || s.start || "").toLocaleString() + '</td>' +
            '<td><i class="fas fa-map-marker-alt" style="color:#e53935;margin-left:4px;"></i>' + escHtml(loc) + region + '</td>' +
            '<td>' + escHtml(s.device || "") + '</td>' +
            '</tr>';
    }).join("");

    sesEl.innerHTML = '<table class="stats-table">' +
        '<thead><tr><th>#</th><th>کات</th><th>شار و وڵات</th><th>ئامێر</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>';
}


// ---- پری KV ----
function renderKvUsage(usage) {
    var el = document.getElementById("stat-kv-usage");
    if (!el) return;
    if (!usage) { el.textContent = "—"; return; }
    var pct  = usage.percent || 0;
    var used = usage.usedMB  || "?";
    var max  = usage.maxMB   || "?";
    el.textContent = used + " / " + max + " MB";
    var bar = document.getElementById("kv-usage-bar");
    if (bar) {
        bar.style.width = Math.min(pct, 100) + "%";
        bar.style.background = pct > 80 ? "#e53935" : pct > 50 ? "#fb8c00" : "var(--accent)";
    }
}


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

    var html = '<div class="snap-list">';
    snaps.slice(0, 50).forEach(function(s, i) {
        var uid     = "snap_" + i;
        var timeStr = "";
        try { timeStr = new Date(s.time).toLocaleTimeString(); } catch(e) {}
        var txt     = s.text || s.preview || "";
        var shortTxt = txt.length > 80 ? txt.substring(0, 80) + "…" : txt;

        html += '<div class="snap-row" id="' + uid + '_row">' +
            '<div class="snap-header">' +
                '<span class="snap-label"><i class="fas fa-mouse-pointer"></i> ' + escHtml(s.label || "—") + '</span>' +
                '<span class="snap-time"><i class="fas fa-clock"></i> ' + timeStr + '</span>' +
                '<span class="snap-len">' + (s.length || txt.length) + ' پیت</span>' +
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

    el.innerHTML = html;
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

    fetch("/track")
        .then(r => r.json())
        .then(function(data) {
            var archives = data.archiveList || [];
            if (!archives.length) {
                listEl.innerHTML = '<div class="no-data"><i class="fas fa-info-circle"></i> هێشتا ئەرشیفێک نییە</div>';
                return;
            }

            listEl.innerHTML = archives.map(function(a) {
                return '<div class="archive-row">' +
                    '<div class="archive-week"><i class="fas fa-calendar-week"></i> ' + escHtml(a.week.replace("_", " → ")) + '</div>' +
                    '<div class="archive-meta">' +
                        '<span><i class="fas fa-globe"></i> ' + (a.totalVisits || 0) + ' سەردان</span>' +
                        '<span><i class="fas fa-mouse-pointer"></i> ' + (a.totalClicks || 0) + ' کلیک</span>' +
                    '</div>' +
                    '<div class="archive-btns">' +
                        '<a href="' + escHtml(a.fileJson) + '" target="_blank" class="archive-dl json">JSON</a>' +
                        '<a href="' + escHtml(a.fileCsv)  + '" target="_blank" class="archive-dl csv">CSV</a>' +
                    '</div>' +
                    '</div>';
            }).join("");
        })
        .catch(function() {
            listEl.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-circle"></i> هەڵە لە بارکردنی ئەرشیفەکان</div>';
        });
}

// ===========================
//  تاب ٦ — گۆڕینی پاسوۆرد
// ===========================

function changePassword() {
    var oldPass     = document.getElementById("oldPass").value;
    var newPass     = document.getElementById("newPass").value;
    var confirmPass = document.getElementById("confirmPass").value;
    var msgEl       = document.getElementById("passMsg");

    if (oldPass !== ADMIN_PASS) {
        msgEl.className = "pass-error";
        msgEl.innerHTML = '<i class="fas fa-times-circle"></i> پاسوۆردی ئێستا هەڵەیە';
        msgEl.style.display = "block"; return;
    }
    if (newPass.length < 6) {
        msgEl.className = "pass-error";
        msgEl.innerHTML = '<i class="fas fa-times-circle"></i> پاسوۆردی نوێ دەبێت لانیکەم ٦ پیت بێت';
        msgEl.style.display = "block"; return;
    }
    if (newPass !== confirmPass) {
        msgEl.className = "pass-error";
        msgEl.innerHTML = '<i class="fas fa-times-circle"></i> پاسوۆردەکان یەکسان نین';
        msgEl.style.display = "block"; return;
    }

    ADMIN_PASS = newPass;
    localStorage.setItem("adminPass", newPass);
    msgEl.className = "pass-success";
    msgEl.innerHTML = '<i class="fas fa-check-circle"></i> پاسوۆرد بە سەرکەوتوویی گۆڕدرا!';
    msgEl.style.display = "block";
    document.getElementById("oldPass").value      = "";
    document.getElementById("newPass").value      = "";
    document.getElementById("confirmPass").value  = "";
    showToast("✅ پاسوۆرد گۆڕدرا!");
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
        initPanel();
    }
});
