/* ElderCare Medicines — dose tracking, stock, expiry, reminders */
(function () {
  const MED_KEY = "medicines";
  const TAKEN_KEY = "eldercareMedTaken"; // { "YYYY-MM-DD": { "medId@HH:MM": { at: iso } } }
  const REMIND_KEY = "eldercareMedReminded"; // keys already notified today

  const demoMedicines = [
    { id: "m1", name: "Amlodipine", dosage: "5 mg", times: ["08:00", "20:00"], stock: 12, minStock: 5, expiry: "2027-04-01" },
    { id: "m2", name: "Metformin", dosage: "500 mg", times: ["08:00", "20:00"], stock: 3, minStock: 5, expiry: "2026-12-01" }
  ];

  /** Medicines belong to the SENIOR, not the logged-in family member.
   *  Senior login  → that senior's phone
   *  Family/Helper → linked senior's phone
   *  No linked senior → null (empty list, nothing shared)
   */
  function seniorPhoneForMeds() {
    try {
      if (typeof session === "undefined" || !session || !session.user) return "";
      const role = session.role || session.user.role || "";
      const myPhone = String(session.user.phone || "").replace(/\D/g, "");
      if (role === "senior") return myPhone;
      // Family / caregiver / helper: use linked senior only
      let sen = String(session.user.linkedSeniorPhone || "").replace(/\D/g, "");
      if (sen.length >= 10) return sen;
      const list = session.user.linkedSeniors || [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s) continue;
        if (typeof s === "string") {
          if (s.startsWith("local-")) {
            const p = s.replace(/^local-/, "");
            if (/^[6-9]\d{9}$/.test(p)) return p;
          }
          if (/^[6-9]\d{9}$/.test(s)) return s;
          continue;
        }
        const p = String(s.phone || "").replace(/\D/g, "");
        if (p.length >= 10) return p;
      }
      // linkedSeniorIds like local-9xxxxxxxxx
      const ids = session.user.linkedSeniorIds || [];
      for (let i = 0; i < ids.length; i++) {
        const id = String(ids[i] || "");
        if (id.startsWith("local-")) {
          const p = id.replace(/^local-/, "");
          if (/^[6-9]\d{9}$/.test(p)) return p;
        }
      }
      return ""; // not linked → no senior medicines
    } catch (e) {
      return "";
    }
  }

  function medOwnerKey() {
    const sen = seniorPhoneForMeds();
    if (sen) return MED_KEY + "_senior_" + sen;
    // Isolated empty bucket so unlinked accounts never share
    const me = String((session && session.user && session.user.phone) || "none").replace(/\D/g, "") || "none";
    return MED_KEY + "_unlinked_" + me;
  }

  function takenOwnerKey() {
    const sen = seniorPhoneForMeds();
    if (sen) return TAKEN_KEY + "_senior_" + sen;
    const me = String((session && session.user && session.user.phone) || "none").replace(/\D/g, "") || "none";
    return TAKEN_KEY + "_unlinked_" + me;
  }

  function normalizeMedList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(m => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage || m.dose || "",
      times: Array.isArray(m.times) ? m.times : [],
      stock: Math.max(0, Number(m.stock) || 0),
      minStock: Math.max(0, Number(m.minStock != null ? m.minStock : 5)),
      expiry: m.expiry || ""
    }));
  }

  function loadMedicines() {
    try {
      // Unlinked family: never show another senior's meds
      const sen = seniorPhoneForMeds();
      const role = (typeof session !== "undefined" && session && (session.role || (session.user && session.user.role))) || "";
      if ((role === "family" || role === "caregiver" || role === "helper") && !sen) {
        return [];
      }
      const key = medOwnerKey();
      let raw = JSON.parse(localStorage.getItem(key) || "null");
      // One-time migrate: if senior key empty, copy from old per-login-user key for THIS senior only
      if ((!Array.isArray(raw) || !raw.length) && sen) {
        const legacySenior = JSON.parse(localStorage.getItem(MED_KEY + "_" + sen) || "null");
        if (Array.isArray(legacySenior) && legacySenior.length) {
          const isDemo = legacySenior.length <= 2 && legacySenior.every(m => m && (m.id === "m1" || m.id === "m2") && (m.name === "Amlodipine" || m.name === "Metformin"));
          if (!isDemo) {
            raw = legacySenior;
            localStorage.setItem(key, JSON.stringify(legacySenior));
          }
        }
      }
      // Do NOT copy the global "medicines" key — that caused cross-user leaks
      if (Array.isArray(raw)) {
        const isDemo = raw.length <= 2 && raw.every(m => m && (m.id === "m1" || m.id === "m2") && (m.name === "Amlodipine" || m.name === "Metformin"));
        if (isDemo) return [];
        return normalizeMedList(raw);
      }
    } catch (e) {}
    return [];
  }

  function saveMedicinesList(list) {
    const role = (typeof session !== "undefined" && session && (session.role || (session.user && session.user.role))) || "";
    const sen = seniorPhoneForMeds();
    // Family without linked senior cannot save shared meds
    if ((role === "family" || role === "caregiver" || role === "helper") && !sen) {
      if (typeof window !== "undefined") {
        window.medicines = [];
        try { if (typeof medicines !== "undefined") medicines = []; } catch (e) {}
      }
      if (typeof toast === "function") {
        toast((typeof t === "function" ? t("link_senior_first") : null) || "Link a senior first to manage medicines", true);
      }
      return;
    }
    const key = medOwnerKey();
    localStorage.setItem(key, JSON.stringify(list || []));
    pushListToCloud(list || []);
    // Also write senior-phone legacy key so senior app sees the same list
    if (sen) {
      try { localStorage.setItem(MED_KEY + "_" + sen, JSON.stringify(list || [])); } catch (e) {}
    }
    if (typeof window !== "undefined") {
      window.medicines = list || [];
      try { if (typeof medicines !== "undefined") medicines = list || []; } catch (e) {}
      try { window.dispatchEvent(new CustomEvent("medicines-updated")); } catch (e) {}
    }
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function loadTaken() {
    try { return JSON.parse(localStorage.getItem(takenOwnerKey()) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveTaken(map) {
    localStorage.setItem(takenOwnerKey(), JSON.stringify(map));
    try { window.dispatchEvent(new CustomEvent("medicines-taken-updated")); } catch (e) {}
  }

  function doseKey(medId, time) {
    return medId + "@" + time;
  }

  function timeToMinutes(time) {
    const parts = String(time || "00:00").split(":");
    return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
  }

  function nowMinutes() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  function fmtExpiry(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return iso; }
  }

  function fmtTime(time) {
    if (typeof formatTime === "function") return formatTime(time);
    const [h, m] = String(time).split(":").map(Number);
    const d = new Date(2000, 0, 1, h || 0, m || 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function getDoseStatus(medId, time) {
    const taken = loadTaken();
    const day = taken[todayKey()] || {};
    const rec = day[doseKey(medId, time)];
    if (rec) return { status: "taken", takenAt: rec.at };
    const mins = timeToMinutes(time);
    const now = nowMinutes();
    if (now < mins) return { status: "upcoming" };
    if (now <= mins + 60) return { status: "due" };
    return { status: "missed" };
  }

  function buildTodayDoses() {
    const list = loadMedicines();
    const doses = [];
    list.forEach(m => {
      (m.times || []).forEach(time => {
        const st = getDoseStatus(m.id, time);
        doses.push({
          medId: m.id,
          name: m.name,
          dosage: m.dosage,
          time,
          minutes: timeToMinutes(time),
          stock: m.stock,
          minStock: m.minStock,
          expiry: m.expiry,
          status: st.status,
          takenAt: st.takenAt || null
        });
      });
    });
    doses.sort((a, b) => a.minutes - b.minutes);
    return doses;
  }

  function stockAlerts() {
    const list = loadMedicines();
    const low = list.filter(m => Number(m.stock) <= Number(m.minStock || 0));
    return low;
  }

  function expiryAlerts() {
    const list = loadMedicines();
    const today = todayKey();
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in7s = in7.toISOString().slice(0, 10);
    const expired = [];
    const todayExp = [];
    const soon = [];
    list.forEach(m => {
      if (!m.expiry) return;
      if (m.expiry < today) expired.push(m);
      else if (m.expiry === today) todayExp.push(m);
      else if (m.expiry <= in7s) soon.push(m);
    });
    return { expired, todayExp, soon };
  }

  function markDoseTaken(medId, time) {
    const taken = loadTaken();
    const day = todayKey();
    if (!taken[day]) taken[day] = {};
    const key = doseKey(medId, time);
    // A dose can be marked only once per date
    if (taken[day][key]) return false;

    const markedBy = {
      role: (typeof session !== "undefined" && session?.role) || "family",
      name: (typeof session !== "undefined" && session?.user?.name) || "",
      uid: (typeof session !== "undefined" && session?.user?.uid) || ""
    };
    taken[day][key] = {
      medId: medId,
      time: time,
      date: day,
      at: new Date().toISOString(),
      by: markedBy
    };
    saveTaken(taken);
    pushTakenToCloud(day, key, taken[day][key]);

    // Reduce stock by 1 once, never below 0
    const list = loadMedicines();
    const med = list.find(m => m.id === medId);
    if (med) {
      med.stock = Math.max(0, Number(med.stock) - 1);
      saveMedicinesList(list);
    }
    return true;
  }

  function statusLabel(status) {
    // Prefer app i18n (follows selected language); fallback EN/HI
    const hi = (typeof activeLanguage !== "undefined" && activeLanguage === "hi") || localStorage.getItem("language") === "hi";
    const defaults = {
      upcoming: { en: "Upcoming", hi: "आगामी", key: "upcoming" },
      due: { en: "Due now", hi: "अभी लें", key: "due_now" },
      missed: { en: "Missed", hi: "छूटा", key: "missed" },
      taken: { en: "Taken", hi: "ले ली", key: "taken" }
    };
    const row = defaults[status];
    if (!row) return status;
    if (typeof t === "function") {
      const v = t(row.key);
      if (v && v !== row.key) return v;
    }
    return hi ? row.hi : row.en;
  }

  function statusClass(status) {
    return ({ upcoming: "med-status-upcoming", due: "med-status-due", missed: "med-status-missed", taken: "med-status-taken" })[status] || "";
  }

  function renderDoseCard(d, opts) {
    const canTake = opts && opts.canTake && d.status !== "taken";
    const chipClass = ({ upcoming: "upcoming", due: "due", missed: "missed", taken: "taken" })[d.status] || "upcoming";
    const chip = d.status === "taken"
      ? `<span class="status-chip taken">${statusLabel("taken")}${d.takenAt ? " " + new Date(d.takenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</span>`
      : `<span class="status-chip ${chipClass}">${statusLabel(d.status)}</span>`;
    return `<div class="dose-card">
      <div class="dose-time">${fmtTime(d.time)}</div>
      <div class="dose-info">
        <strong>${esc(d.name)}</strong>
        <span>${esc(d.dosage || "")}</span>
      </div>
      <div class="dose-side">
        ${chip}
        ${canTake ? `<button type="button" class="btn btn-primary dose-taken-btn" onclick="markMedicineTaken('${d.medId}','${d.time}')">${(typeof t === "function" ? t("taken") : null) || "Taken"}</button>` : ""}
      </div>
    </div>`;
  }

  function renderTodayList(canTake) {
    const doses = buildTodayDoses();
    if (!doses.length) {
      return `<div class="empty card"><h2>${(typeof t === "function" ? t("no_medicines_list") : null) || "No medicines"}</h2></div>`;
    }
    const takenCount = doses.filter(d => d.status === "taken").length;
    const summary = `<p class="med-summary">${takenCount} ${(typeof t === "function" ? t("of") : null) || "of"} ${doses.length} ${(typeof t === "function" ? t("taken_today") : null) || "taken today"}</p>`;
    return summary + `<div class="stack med-dose-list">${doses.map(d => renderDoseCard(d, { canTake: !!canTake })).join("")}</div>`;
  }

    function renderAlertsBlock() {
    const list = loadMedicines();
    const exp = expiryAlerts();
    const parts = [];
    list.forEach(m => {
      const stock = Number(m.stock);
      const min = Number(m.minStock || 0);
      if (stock <= 0) {
        parts.push(`<div class="stock-alert stock-danger">
  <span class="stock-icon"><i class="fa-solid fa-circle-xmark"></i></span>
  <span class="stock-text">
    <strong>${(typeof t === "function" ? t("out_of_stock") : null) || "Out of stock"}: ${esc(m.name)}</strong>
    <span>${((typeof t === "function" ? t("only_left_detail") : null) || "Only {n} left (minimum {min}). Please refill.").replace("{n}", "0").replace("{min}", String(min))}</span>
  </span>
</div>`);
      } else if (stock <= min) {
        parts.push(`<div class="stock-alert stock-warn">
  <span class="stock-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
  <span class="stock-text">
    <strong>${(typeof t === "function" ? t("low_stock") : null) || "Low stock"}: ${esc(m.name)}</strong>
    <span>${((typeof t === "function" ? t("only_left_detail") : null) || "Only {n} left (minimum {min}). Please refill.").replace("{n}", String(stock)).replace("{min}", String(min))}</span>
  </span>
</div>`);
      }
    });
    exp.expired.forEach(m => {
      parts.push(`<div class="stock-alert stock-danger">
  <span class="stock-icon"><i class="fa-solid fa-circle-xmark"></i></span>
  <span class="stock-text">
    <strong>${(typeof t === "function" ? t("expired") : null) || "Expired"}: ${esc(m.name)}</strong>
    <span>${fmtExpiry(m.expiry)}</span>
  </span>
</div>`);
    });
    exp.todayExp.forEach(m => {
      parts.push(`<div class="stock-alert stock-warn">
  <span class="stock-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
  <span class="stock-text">
    <strong>${(typeof t === "function" ? t("expires_today") : null) || "Expires today"}: ${esc(m.name)}</strong>
    <span>${fmtExpiry(m.expiry)}</span>
  </span>
</div>`);
    });
    exp.soon.forEach(m => {
      parts.push(`<div class="stock-alert stock-warn">
  <span class="stock-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
  <span class="stock-text">
    <strong>${(typeof t === "function" ? t("expires_soon") : null) || "Expiring within 7 days"}: ${esc(m.name)}</strong>
    <span>${fmtExpiry(m.expiry)}</span>
  </span>
</div>`);
    });
    return parts.length ? `<div class="stock-alert-list">${parts.join("")}</div>` : "";
  }

  function checkStockNotifications() {
    if (!session || session.role !== "family") return;
    const key = "eldercareStockNotified";
    let map = {};
    try { map = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) {}
    loadMedicines().forEach(m => {
      const stock = Number(m.stock);
      const min = Number(m.minStock || 0);
      const level = stock <= 0 ? "zero" : (stock <= min ? "low" : "ok");
      const prev = map[m.id];
      if (level === "ok") { delete map[m.id]; return; }
      if (prev === level) return;
      map[m.id] = level;
      const title = (typeof t === "function" ? t("app_name") : null) || "ElderCare";
      let body;
      if (level === "zero") body = ((typeof t === "function" ? t("out_of_stock") : null) || "Out of stock") + ": " + m.name;
      else body = ((typeof t === "function" ? t("low_stock") : null) || "Low stock") + ": " + m.name + ". Only " + stock + " left.";
      if (typeof ecNotify === "function") ecNotify(title, body, { tag: "stock-" + m.id, channel: "general" });
    });
    localStorage.setItem(key, JSON.stringify(map));
  }

    function renderFamilyMedicinesPage() {
    const list = loadMedicines();
    const alerts = renderAlertsBlock();
    const allCards = list.map(m => {
      const timesLine = (m.times || []).map(fmtTime).join(", ") || "—";
      const stockLine = Number(m.stock) + " left, minimum " + Number(m.minStock);
      const expLine = m.expiry ? fmtExpiry(m.expiry) : "—";
      return `<article class="card med-all-card">
        <strong class="med-all-name">${esc(m.name)}</strong>
        <span class="med-all-dose">${esc(m.dosage || "")}</span>
        <div class="med-detail-rows">
          <div class="med-detail-row"><span class="med-label">${(typeof t === "function" ? t("times") : null) || "Times"}:</span> <span>${timesLine}</span></div>
          <div class="med-detail-row"><span class="med-label">${(typeof t === "function" ? t("stock") : null) || "Stock"}:</span> <span>${stockLine}</span></div>
          <div class="med-detail-row"><span class="med-label">${(typeof t === "function" ? t("expiry") : null) || "Expiry"}:</span> <span>${expLine}</span></div>
        </div>
        <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary" onclick="openMedicineForm('${m.id}')">${(typeof t === "function" ? t("edit") : null) || "Edit"}</button>
          <button type="button" class="btn btn-ghost" style="color:var(--danger)" onclick="deleteMedicineById('${m.id}')">${(typeof t === "function" ? t("delete") : null) || "Delete"}</button>
        </div>
      </article>`;
    }).join("") || `<div class="empty card"><p class="muted">${(typeof t === "function" ? t("no_medicines_list") : null) || "No medicines"}</p></div>`;
    return `<div class="page-content med-page">
      <div class="row between" style="align-items:center">
        <h1 class="page-title">${(typeof t === "function" ? t("medicines") : null) || "Medicines"}</h1>
        <button type="button" class="btn btn-primary" onclick="openMedicineForm()">${(typeof t === "function" ? t("add") : null) || "Add"}</button>
      </div>
      ${alerts ? `<h2 class="section-title">${(typeof t === "function" ? t("alerts") : null) || "Alerts"}</h2><div class="stack" style="gap:12px">${alerts}</div>` : ""}
      <h2 class="section-title">${(typeof t === "function" ? t("today") : null) || "Today"}</h2>
      ${renderTodayList(true)}
      <h2 class="section-title">${(typeof t === "function" ? t("all_medicines") : null) || "All medicines"}</h2>
      <div class="stack">${allCards}</div>
    </div>`;
  }

  function renderSeniorMedicinesPage() {
    return `<div class="page-content med-page">
      <h1>${(typeof t === "function" ? t("my_medicines") : null) || "My Medicines"}</h1>
      ${renderTodayList(true)}
    </div>`;
  }

  function nextDoseForHome() {
    const doses = buildTodayDoses().filter(d => d.status !== "taken");
    // Prefer due now, then upcoming, then missed (still untaken)
    return doses.find(d => d.status === "due")
      || doses.find(d => d.status === "upcoming")
      || doses.find(d => d.status === "missed")
      || null;
  }

  function openMedicineForm(id) {
    const list = loadMedicines();
    const existing = id ? list.find(m => m.id === id) : null;
    const title = existing
      ? ((typeof t === "function" ? t("edit_medicine") : null) || "Edit medicine")
      : ((typeof t === "function" ? t("add_medicine") : null) || "Add medicine");
    const m = modal(`<h2>${title}</h2>
      <form id="medicine-form" class="stack">
        <div class="form-field"><label>${(typeof t === "function" ? t("name") : null) || "Name"}</label>
          <input name="name" required value="${esc(existing?.name || "")}"></div>
        <div class="form-field"><label>${(typeof t === "function" ? t("dosage") : null) || "Dose"}</label>
          <input name="dosage" required value="${esc(existing?.dosage || "")}" placeholder="500 mg"></div>
        <div class="form-field"><label>${(typeof t === "function" ? t("times_comma") : null) || "Times (comma separated)"}</label>
          <input name="times" required value="${esc((existing?.times || []).join(", "))}" placeholder="08:00, 20:00"></div>
        <div class="form-field"><label>${(typeof t === "function" ? t("total_stock") : null) || "Quantity"}</label>
          <input name="stock" type="number" min="0" required value="${existing ? Number(existing.stock) : 10}"></div>
        <div class="form-field"><label>${(typeof t === "function" ? t("min_stock") : null) || "Minimum stock"}</label>
          <input name="minStock" type="number" min="0" required value="${existing ? Number(existing.minStock) : 5}"></div>
        <div class="form-field"><label>${(typeof t === "function" ? t("expiry") : null) || "Expiry"}</label>
          <input name="expiry" type="date" value="${esc(existing?.expiry || "")}"></div>
        <button class="btn btn-primary" type="submit">${(typeof t === "function" ? t("save") : null) || "Save"}</button>
      </form>`);
    document.getElementById("medicine-form").onsubmit = function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const times = String(fd.get("times") || "").split(/[,;]/).map(x => x.trim()).filter(Boolean);
      const entry = {
        id: existing ? existing.id : ("m" + Date.now()),
        name: String(fd.get("name") || "").trim(),
        dosage: String(fd.get("dosage") || "").trim(),
        times,
        stock: Math.max(0, Number(fd.get("stock")) || 0),
        minStock: Math.max(0, Number(fd.get("minStock")) || 0),
        expiry: String(fd.get("expiry") || "")
      };
      let next;
      if (existing) {
        next = list.map(x => x.id === existing.id ? entry : x);
      } else {
        next = list.concat([entry]);
      }
      saveMedicinesList(next);
      m.remove();
      toast((typeof t === "function" ? t("medicine_saved") : null) || "Saved");
      if (typeof render === "function") render();
    };
  }

  function deleteMedicineById(id) {
    if (!confirm((typeof t === "function" ? t("delete_medicine") : null) || "Delete this medicine?")) return;
    const next = loadMedicines().filter(m => m.id !== id);
    saveMedicinesList(next);
    toast((typeof t === "function" ? t("medicine_deleted") : null) || "Deleted");
    if (typeof render === "function") render();
  }

  function markMedicineTaken(medId, time) {
    // Disable any matching Taken buttons immediately to block double taps
    try {
      document.querySelectorAll('.dose-taken-btn').forEach(btn => {
        const oc = btn.getAttribute("onclick") || "";
        if (oc.indexOf(medId) >= 0 && oc.indexOf(time) >= 0) {
          btn.disabled = true;
          btn.setAttribute("disabled", "disabled");
          btn.style.opacity = "0.5";
          btn.style.pointerEvents = "none";
        }
      });
    } catch (e) {}

    const ok = markDoseTaken(medId, time);
    if (!ok) return; // already marked — ignore repeat
    if (typeof toast === "function") toast((typeof t === "function" ? t("marked_taken") : null) || "Marked taken");
    // Full refresh so dose chip, summary, stock, alerts, home next-dose all update
    if (typeof render === "function") render();
    // Cross-tab: storage event covers other tabs; same-tab already rendered
    try {
      // Force a storage poke for listeners that only watch storage
      localStorage.setItem(TAKEN_KEY + "_tick", String(Date.now()));
    } catch (e) {}
  }

  // —— Reminders ——
  function loadReminded() {
    try { return JSON.parse(localStorage.getItem(REMIND_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveReminded(map) {
    localStorage.setItem(REMIND_KEY, JSON.stringify(map));
  }

  function pushNotify(title, body, tag, channel) {
    if (typeof ecNotify === "function") ecNotify(title, body, { tag: tag || "med", channel: channel || "meds" });
  }

  function checkMedicineReminders() {
    if (!session || !session.user) return;
    const day = todayKey();
    const reminded = loadReminded();
    if (!reminded[day]) reminded[day] = {};
    const now = nowMinutes();
    const nowStr = String(Math.floor(now / 60)).padStart(2, "0") + ":" + String(now % 60).padStart(2, "0");
    const doses = buildTodayDoses();
    const sen = seniorPhoneForMeds();
    const linked = (session.user.linkedSeniors || []).find(s => s && String(s.phone || "").replace(/\D/g, "") === sen);
    const seniorName = session.role === "senior" ? (session.user.name || "Senior") : ((linked && linked.name) || session.user.linkedSeniors?.[0]?.name || "Senior");

    doses.forEach(d => {
      if (d.status === "taken") return;
      const dueKey = "due@" + doseKey(d.medId, d.time);
      const missKey = "miss@" + doseKey(d.medId, d.time);
      // Due at exact time (within same minute)
      // Due: within the dose minute (or up to 5 min late if the app was paused)
      if (now >= d.minutes && now <= d.minutes + 5 && !reminded[day][dueKey]) {
        reminded[day][dueKey] = 1;
        const msg = medL("Time to take " + d.name + " " + (d.dosage || ""), d.name + " " + (d.dosage || "") + " लेने का समय");
        // In the installed app the senior's phone already has this reminder scheduled (works even when the app is closed)
        const alreadyScheduled = session.role === "senior" && typeof ecPlugin === "function" && ecPlugin("LocalNotifications");
        if (session.role === "senior" && !alreadyScheduled) pushNotify(medL("ElderCare", "एल्डरकेयर"), msg, dueKey, "meds");
        if (typeof toast === "function" && session.role === "senior") toast(msg);
      }
      // Missed: 60 min after and still not taken — notify family once (even if the app was opened later)
      if (d.status === "missed" && now <= d.minutes + 360 && !reminded[day][missKey]) {
        reminded[day][missKey] = 1;
        if (session.role === "family" || session.role === "caregiver") {
          const msg = medL(seniorName + " has not taken " + d.name + " (" + fmtTime(d.time) + ").", seniorName + " ने " + d.name + " (" + fmtTime(d.time) + ") नहीं ली है।");
          pushNotify(medL("Missed medicine", "दवा छूट गई"), msg, missKey, "meds");
          if (typeof toast === "function") toast(msg, true);
        }
      }
    });
    // prune old days
    Object.keys(reminded).forEach(k => { if (k !== day) delete reminded[k]; });
    saveReminded(reminded);
  }

  // Sync across tabs / devices sharing the same browser storage
  function overlayIsOpen() {
    return !!document.querySelector(".modal-backdrop, .sos-family-overlay, .perm-explain-overlay");
  }
  function refreshMedViewsFromSharedData() {
    try { window.medicines = loadMedicines(); } catch (err) {}
    // Never re-render while a sheet/modal (Add, Upload, SOS...) is open: it would wipe it.
    if (overlayIsOpen()) { window.__medRefreshPending = true; return; }
    window.__medRefreshPending = false;
    if (typeof render === "function" && typeof session !== "undefined" && session?.user) {
      const route = (location.hash.replace("#/", "") || "home");
      if (route === "medicines" || route === "home" || route === "" || route === "family") {
        render();
      }
    }
  }
  window.addEventListener("storage", function (e) {
    if (e.key && (e.key.indexOf(MED_KEY) === 0 || e.key.indexOf(TAKEN_KEY) === 0)) {
      refreshMedViewsFromSharedData();
    }
  });
  window.addEventListener("medicines-updated", refreshMedViewsFromSharedData);
  window.addEventListener("medicines-taken-updated", refreshMedViewsFromSharedData);
  // Poll lightly so senior/family tabs stay aligned within a few seconds
  try { window.__medTickSeen = localStorage.getItem(TAKEN_KEY + "_tick") || ""; } catch (e) { window.__medTickSeen = ""; }
  setInterval(function () {
    if (typeof session === "undefined" || !session?.user) return;
    if (window.__medRefreshPending && !overlayIsOpen()) { refreshMedViewsFromSharedData(); return; }
    try {
      const stamp = localStorage.getItem(TAKEN_KEY + "_tick") || "";
      if (window.__medTickSeen !== stamp) {
        window.__medTickSeen = stamp;
        refreshMedViewsFromSharedData();
      }
    } catch (e) {}
  }, 12000);

  // —— Cloud sync: Firestore "seniorMeds/<seniorPhone>" = { list, taken, updatedAt } ——
  // Family and senior read/write the SAME document, so changes show on every phone.
  const CLOUD_COL = "seniorMeds";
  let medsUnsub = null, medsFor = "";
  function medL(en, hi) { try { return (typeof activeLanguage !== "undefined" && activeLanguage === "hi") ? hi : en; } catch (e) { return en; } }
  function medsDb() { try { return (typeof db !== "undefined" && db) ? db : null; } catch (e) { return null; } }
  function myPhoneDigits() { return String((session && session.user && session.user.phone) || "").replace(/\D/g, ""); }
  function pruneTaken(map) {
    const keep = {};
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const c = cutoff.toISOString().slice(0, 10);
    Object.keys(map || {}).forEach(d => { if (d >= c) keep[d] = map[d]; });
    return keep;
  }
  function pushListToCloud(list) {
    const d = medsDb(), sen = seniorPhoneForMeds();
    if (!d || !sen) return;
    d.collection(CLOUD_COL).doc(sen).set({ list: normalizeMedList(list), updatedAt: Date.now(), updatedBy: myPhoneDigits() }, { merge: true })
      .catch(e => console.warn("meds cloud save", e && e.code));
  }
  function pushTakenToCloud(day, key, rec) {
    const d = medsDb(), sen = seniorPhoneForMeds();
    if (!d || !sen || !rec) return;
    d.collection(CLOUD_COL).doc(sen).set({ taken: { [day]: { [key]: rec } }, updatedAt: Date.now(), updatedBy: myPhoneDigits() }, { merge: true })
      .catch(e => console.warn("taken cloud save", e && e.code));
  }
  function stopMedsCloud() { if (medsUnsub) { try { medsUnsub(); } catch (e) {} } medsUnsub = null; medsFor = ""; }
  function startMedsCloud() {
    const d = medsDb();
    if (!d || typeof session === "undefined" || !session || !session.user) return;
    const sen = seniorPhoneForMeds();
    if (medsUnsub && medsFor === sen) return;
    stopMedsCloud();
    if (!sen) return;
    medsFor = sen;
    const ref = d.collection(CLOUD_COL).doc(sen);
    medsUnsub = ref.onSnapshot(doc => {
      if (medsFor !== sen) return;
      const localList = loadMedicines();
      const localTaken = loadTaken();
      if (!doc.exists) {
        // First time for this senior: upload whatever this phone already has
        if (localList.length || Object.keys(localTaken).length) {
          ref.set({ list: localList, taken: pruneTaken(localTaken), updatedAt: Date.now(), updatedBy: myPhoneDigits() }, { merge: true }).catch(() => {});
        }
        return;
      }
      const data = doc.data() || {};
      let changed = false;
      if (Array.isArray(data.list)) {
        const nx = JSON.stringify(normalizeMedList(data.list));
        if (localStorage.getItem(medOwnerKey()) !== nx) {
          localStorage.setItem(medOwnerKey(), nx);
          try { localStorage.setItem(MED_KEY + "_" + sen, nx); } catch (e) {}
          changed = true;
        }
      }
      // Taken doses: union of this phone + cloud (cloud wins for the same dose)
      const cloudTaken = (data.taken && typeof data.taken === "object") ? data.taken : {};
      const merged = JSON.parse(JSON.stringify(localTaken));
      let localHasExtra = false;
      Object.keys(cloudTaken).forEach(day => { merged[day] = Object.assign({}, merged[day] || {}, cloudTaken[day] || {}); });
      Object.keys(localTaken).forEach(day => Object.keys(localTaken[day] || {}).forEach(k => { if (!(cloudTaken[day] && cloudTaken[day][k])) localHasExtra = true; }));
      const pruned = pruneTaken(merged);
      if (JSON.stringify(pruned) !== JSON.stringify(localTaken)) {
        localStorage.setItem(takenOwnerKey(), JSON.stringify(pruned));
        changed = true;
      }
      if (localHasExtra) ref.set({ taken: pruneTaken(localTaken), updatedAt: Date.now() }, { merge: true }).catch(() => {});
      if (Object.keys(cloudTaken).length > 10) ref.update({ taken: pruneTaken(cloudTaken) }).catch(() => {});
      if (changed) {
        window.medicines = loadMedicines();
        refreshMedViewsFromSharedData();
        scheduleSeniorReminders();
        checkStockNotifications();
      }
    }, err => {
      console.warn("meds cloud listen", err && err.code);
      stopMedsCloud();
      setTimeout(startMedsCloud, 15000);   // e.g. still signing in — try again
    });
  }
  window.ecMedsCloudRestart = function () { stopMedsCloud(); startMedsCloud(); };

  // —— Senior phone: schedule daily reminders on the device (fire even when the app is closed) ——
  const SCHED_KEY = "eldercareMedSchedIds";
  function notifIdFor(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (Math.abs(h) % 1000000000) + 1000; }
  async function cancelSeniorReminders(LN) {
    let old = [];
    try { old = JSON.parse(localStorage.getItem(SCHED_KEY) || "[]"); } catch (e) {}
    if (old.length) { try { await LN.cancel({ notifications: old.map(id => ({ id })) }); } catch (e) {} }
    localStorage.removeItem(SCHED_KEY);
    localStorage.removeItem(SCHED_KEY + "_sig");
  }
  async function scheduleSeniorReminders() {
    const LN = typeof ecPlugin === "function" ? ecPlugin("LocalNotifications") : null;
    if (!LN) return;
    if (!session || !session.user || session.role !== "senior") {
      if (localStorage.getItem(SCHED_KEY)) await cancelSeniorReminders(LN);
      return;
    }
    const want = [];
    loadMedicines().forEach(m => (m.times || []).forEach(tm => {
      const [h, mi] = String(tm).split(":").map(Number);
      if (isNaN(h) || isNaN(mi)) return;
      want.push({
        id: notifIdFor(myPhoneDigits() + "|" + m.id + "@" + tm),
        title: medL("Medicine time", "दवा का समय"),
        body: medL("Take " + m.name + " " + (m.dosage || "") + " now", "अभी " + m.name + " " + (m.dosage || "") + " लें"),
        channelId: "meds",
        schedule: { on: { hour: h, minute: mi }, allowWhileIdle: true }
      });
    }));
    const sig = JSON.stringify(want.map(w => [w.id, w.body, w.schedule.on]));
    if (localStorage.getItem(SCHED_KEY + "_sig") === sig) return;
    if (typeof ecEnsureNotifyReady === "function" && !(await ecEnsureNotifyReady())) return;
    await cancelSeniorReminders(LN);
    if (want.length) { try { await LN.schedule({ notifications: want }); } catch (e) { console.warn("schedule reminders", e); return; } }
    localStorage.setItem(SCHED_KEY, JSON.stringify(want.map(w => w.id)));
    localStorage.setItem(SCHED_KEY + "_sig", sig);
  }
  window.addEventListener("medicines-updated", () => { scheduleSeniorReminders(); });

  // Start / switch / stop sync whenever the logged-in user or linked senior changes
  let lastSessionSig = null;
  setInterval(function () {
    const s = (typeof session !== "undefined" && session && session.user) ? (session.role + "|" + myPhoneDigits() + "|" + seniorPhoneForMeds()) : "";
    if (s === lastSessionSig) return;
    lastSessionSig = s;
    if (!s) { stopMedsCloud(); scheduleSeniorReminders(); return; }
    window.reloadMedicinesForSession && window.reloadMedicinesForSession();
    startMedsCloud();
    scheduleSeniorReminders();
  }, 2000);

  // Public API
  window.loadMedicines = loadMedicines;
  window.saveMedicinesList = saveMedicinesList;
  window.seniorPhoneForMeds = seniorPhoneForMeds;
  window.buildTodayDoses = buildTodayDoses;
  window.markMedicineTaken = markMedicineTaken;
  window.openMedicineForm = openMedicineForm;
  window.deleteMedicineById = deleteMedicineById;
  window.renderFamilyMedicinesPage = renderFamilyMedicinesPage;
  window.renderSeniorMedicinesPage = renderSeniorMedicinesPage;
  window.renderMedAlertsBlock = renderAlertsBlock;
  window.nextDoseForHome = nextDoseForHome;
  window.checkMedicineReminders = checkMedicineReminders;
  window.stockAlerts = stockAlerts;
  window.expiryAlerts = expiryAlerts;

  // Keep global medicines array in sync (empty until user adds)
  window.medicines = loadMedicines();
  window.saveMedicines = function () {
    saveMedicinesList(window.medicines || loadMedicines());
  };
  // Reload per-user list whenever session changes (sign in / switch account)
  window.reloadMedicinesForSession = function () {
    const list = loadMedicines();
    window.medicines = list;
    if (typeof medicines !== "undefined") {
      try { medicines = list; } catch (e) { window.medicines = list; }
    }
    return list;
  };

  // Reminder loop
  setInterval(checkMedicineReminders, 30000);
  setTimeout(checkMedicineReminders, 2000);
  setTimeout(checkStockNotifications, 3000);
  window.addEventListener("medicines-updated", checkStockNotifications);
})();
