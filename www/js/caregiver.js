/* Caregiver (helper) view — bookings only, no senior/family medicines/food sections */

function caregiverTaskLabel(task) {
  const map = {
    medicines: t("buy_medicines") || "Buy medicines",
    Medicine: t("buy_medicines") || "Buy medicines",
    groceries: t("get_groceries") || "Get groceries",
    Groceries: t("get_groceries") || "Get groceries",
    bills: t("pay_bills") || "Pay bills",
    doctor: t("doctor_visit") || "Doctor visit",
    Hospital: t("doctor_visit") || "Doctor visit",
    lab: t("lab_test") || "Blood test / lab",
    "Blood Test": t("lab_test") || "Blood test / lab",
    pharmacy: t("pharmacy_run") || "Pharmacy",
    accompany: t("accompany_senior") || "Accompany senior",
    other: t("other") || "Other",
    Other: t("other") || "Other",
    Bank: t("task_bank") || "Bank"
  };
  return map[task] || esc(task || "");
}

function caregiverBookingsList() {
  const all = (typeof helperBookings !== "undefined" && helperBookings) ? helperBookings : [];
  // Match only by helper id — no name/phone fallback, no demo number
  // Match by helper id OR helper phone, so tasks show on any phone the helper logs in from
  const myId = session?.user?.helperId || "";
  const myPhone = String(session?.user?.phone || "").replace(/\D/g, "");
  if (!myId && !myPhone) return [];
  return all.filter(b => (myId && b.helperId === myId) || (myPhone && String(b.helperPhone || "").replace(/\D/g, "") === myPhone));
}

function caregiverAssignedSos() {
  try {
    const arr = JSON.parse(localStorage.getItem("pendingSOSAlerts") || "[]");
    return arr.find(a => a.status === "active" || a.status === "responding") || null;
  } catch (e) { return null; }
}

function caregiverFindBookingParty(booking) {
  const familyName = booking.bookedByName || booking.familyName || t("family") || "Family";
  const seniorName = booking.seniorName || session.user?.linkedSeniorName || "";
  const seniorPhone = String(booking.seniorPhone || "").replace(/\D/g, "");
  const familyPhone = String(booking.familyPhone || booking.bookedByPhone || "").replace(/\D/g, "");
  const address = booking.address || "";
  try {
    const users = JSON.parse(localStorage.getItem("eldercareLocalUsers") || "{}");
    const seniors = Object.values(users).filter(u => u.role === "senior");
    const senior = seniors[0];
    return {
      familyName,
      familyPhone: familyPhone || (Object.values(users).find(u => u.role === "family")?.phone || ""),
      seniorName: seniorName || senior?.name || t("senior") || "Senior",
      seniorPhone: seniorPhone || senior?.phone || "",
      address: address || senior?.address || ""
    };
  } catch (e) {
    return { familyName, familyPhone, seniorName: seniorName || t("senior"), seniorPhone, address };
  }
}

async function caregiverUpdateBooking(id, patch) {
  if (typeof helperBookings === "undefined") return;
  const i = helperBookings.findIndex(b => b.id === id);
  if (i < 0) return;
  const next = { ...helperBookings[i], ...patch, updatedAt: Date.now() };
  helperBookings[i] = next;
  if (typeof saveData === "function") saveData();
  render();
  try {
    if (typeof cloudBookingUpdate === "function") {
      const r = await cloudBookingUpdate(id, patch);
      if (r === "failed") toast(t("error") || "Update failed", true);
    }
  } catch (e) {
    toast(t("error") || "Update failed", true);
  }
}

function caregiverAccept(id) { caregiverUpdateBooking(id, { status: "Accepted" }).then(() => toast(t("accepted") || "Accepted")); }
function caregiverDecline(id) { caregiverUpdateBooking(id, { status: "Declined" }).then(() => toast(t("declined") || "Declined")); }
function caregiverMarkDone(id) {
  const b = (helperBookings || []).find(x => x.id === id);
  if (!b || b.status === "Completed") return;
  // Proof photo is compulsory before a task can be completed
  if (!b.proofUrl) {
    toast(t("proof_required") && t("proof_required") !== "Proof Required" ? t("proof_required") : "Please upload a proof photo first, then mark the task completed.", true);
    caregiverUploadProof(id);
    return;
  }
  const patch = { status: "Completed", completedAt: Date.now() };
  if (Array.isArray(b.categories)) {
    patch.categories = b.categories.map(c => ({ ...c, done: (c.items || []).map((_, j) => String(j)) }));
    patch.itemProgress = (() => { let n = 0; patch.categories.forEach(c => n += (c.items || []).length); return n ? n + " of " + n : ""; })();
  }
  caregiverUpdateBooking(id, patch).then(() => toast(t("completed") || "Completed"));
}

async function uploadProofToStorage(bookingId, dataUrl) {
  if (!dataUrl || !bookingId) throw new Error("missing");
  // Prefer Firebase Storage; fall back to separate Firestore doc
  try {
    if (typeof storage !== "undefined" && storage) {
      const ref = storage.ref("bookingProofs/" + bookingId + ".jpg");
      const snap = await ref.putString(dataUrl, "data_url", { contentType: "image/jpeg" });
      return await snap.ref.getDownloadURL();
    }
  } catch (e) {
    console.warn("storage upload failed", e);
  }
  const d = (typeof bookingsDb === "function") ? bookingsDb() : (typeof db !== "undefined" ? db : null);
  if (!d) throw new Error("no backend");
  // Wait for the Firebase sign-in (it runs in the background after login), then try up to 3 times
  if (typeof ecCloudReady === "function") await ecCloudReady(10000);
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      await Promise.race([
        d.collection("bookingProofs").doc(String(bookingId)).set({ dataUrl: dataUrl, at: Date.now() }),
        new Promise((_, rej) => setTimeout(() => rej({ code: "timeout" }), 20000))
      ]);
      return "proof:" + bookingId;
    } catch (e) {
      lastErr = e;
      if (e && (e.code === "permission-denied" || e.code === "invalid-argument")) break;   // retrying won't help
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr || new Error("upload failed");
}

/* Proofs that could not upload yet: kept on this phone and retried automatically */
const EC_PENDING_PROOFS = "eldercarePendingProofs";
function ecPendingProofs() { try { return JSON.parse(localStorage.getItem(EC_PENDING_PROOFS) || "{}") || {}; } catch (e) { return {}; } }
function ecSetPendingProofs(map) { try { localStorage.setItem(EC_PENDING_PROOFS, JSON.stringify(map || {})); } catch (e) {} }
let ecProofRetryBusy = false;
async function ecRetryPendingProofs() {
  if (ecProofRetryBusy) return;
  const map = ecPendingProofs();
  const ids = Object.keys(map);
  if (!ids.length) return;
  ecProofRetryBusy = true;
  try {
    for (const id of ids) {
      try {
        const url = await uploadProofToStorage(id, map[id]);
        const left = ecPendingProofs(); delete left[id]; ecSetPendingProofs(left);
        await caregiverUpdateBooking(id, { proofUrl: url, proofAt: Date.now() });
      } catch (e) { console.warn("proof retry", id, e && e.code); }
    }
  } finally { ecProofRetryBusy = false; }
}
setInterval(() => { if (typeof session !== "undefined" && session && session.user) ecRetryPendingProofs(); }, 20000);

async function resolveProofUrl(proofUrl) {
  if (!proofUrl) return "";
  if (proofUrl.startsWith("http") || proofUrl.startsWith("data:")) return proofUrl;
  if (proofUrl.startsWith("proof:")) {
    const id = proofUrl.slice(6);
    try {
      const d = (typeof bookingsDb === "function") ? bookingsDb() : (typeof db !== "undefined" ? db : null);
      if (!d) return "";
      const doc = await d.collection("bookingProofs").doc(id).get();
      return (doc.exists && doc.data().dataUrl) || "";
    } catch (e) { return ""; }
  }
  return proofUrl;
}

function caregiverUploadProof(id) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.setAttribute("capture", "environment");
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    let dataUrl = "";
    try {
      if (typeof ecCompressRecordImage === "function") dataUrl = await ecCompressRecordImage(file);   // keeps the photo small enough to upload
      else if (typeof compressImage === "function") dataUrl = await compressImage(file);
      else {
        dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
      }
    } catch (e) {
      toast(t("error") || "Upload failed", true);
      return;
    }
    toast(t("uploading") || "Uploading…");
    try {
      const url = await uploadProofToStorage(id, dataUrl);
      await caregiverUpdateBooking(id, { proofUrl: url, proofAt: Date.now() });
      toast((t("proof_uploaded") || "Proof uploaded") + " — " + "you can now mark it completed");
    } catch (e) {
      // Keep the photo on this phone and keep trying in the background — no error popup
      const map = ecPendingProofs(); map[id] = dataUrl; ecSetPendingProofs(map);
      const i = (helperBookings || []).findIndex(b => b.id === id);
      if (i >= 0) { helperBookings[i] = { ...helperBookings[i], proofUrl: dataUrl, updatedAt: Date.now() }; if (typeof saveData === "function") saveData(); render(); }
      const why = (typeof ecCloudErrorText === "function") ? ecCloudErrorText(e && e.code) : "";
      toast(why || "Proof saved on this phone — it will upload automatically when the connection is back.", !!why);
    }
  };
  input.click();
}

function caregiverToggleItem(bookingId, catIdx, itemIdx) {
  if (typeof helperBookings === "undefined") return;
  const i = helperBookings.findIndex(b => b.id === bookingId);
  if (i < 0) return;
  const b = helperBookings[i];
  if (!b.categories || !b.categories[catIdx]) return;
  const cat = b.categories[catIdx];
  if (!Array.isArray(cat.done)) cat.done = [];
  const key = String(itemIdx);
  const pos = cat.done.indexOf(key);
  if (pos >= 0) cat.done.splice(pos, 1);
  else cat.done.push(key);
  let total = 0, done = 0;
  b.categories.forEach(c => {
    (c.items || []).forEach((_, j) => { total++; if ((c.done || []).includes(String(j))) done++; });
  });
  b.itemProgress = total ? (done + " of " + total) : "";
  b.updatedAt = Date.now();
  if (typeof saveData === "function") saveData();
  const patch = {
    categories: b.categories,
    itemProgress: b.itemProgress,
    updatedAt: b.updatedAt
  };
  if (typeof cloudBookingUpdate === "function") {
    cloudBookingUpdate(bookingId, patch).catch(() => toast(t("error") || "Update failed", true));
  }
  render();
}

function caregiverBookingCard(b) {
  const party = caregiverFindBookingParty(b);
  const status = b.status || "Requested";
  const isNew = status === "Requested";
  let total = 0, done = 0;
  const cats = (b.categories || []).map((c, ci) => {
    const items = (c.items || []).map((it, ii) => {
      total++;
      const checked = (c.done || []).includes(String(ii));
      if (checked) done++;
      return `<label class="item-check"><input type="checkbox" ${checked ? "checked" : ""} onchange="caregiverToggleItem('${b.id}',${ci},${ii})"> ${esc(it)}</label>`;
    }).join("");
    return `<div class="booking-cat"><strong>${caregiverTaskLabel(c.category)}</strong>${items || `<p class="muted">${t("no_items") || "No items listed"}</p>`}</div>`;
  }).join("");
  const progress = total ? `<p class="muted">${done} of ${total} ${t("done") || "done"}</p>` : "";
  const badgeCls = (typeof statusBadgeClass === "function") ? statusBadgeClass(status) : (status === "Completed" ? "success" : status === "Declined" || status === "Cancelled" ? "danger" : "blue");
  const proofSrc = (b.proofUrl && (b.proofUrl.startsWith("http") || b.proofUrl.startsWith("data:"))) ? b.proofUrl : "";
  return `<article class="card caregiver-booking">
    <div class="row between">
      <strong>${esc(b.task || caregiverTaskLabel(b.taskType) || t("task") || "Task")}</strong>
      <span class="badge ${badgeCls}">${esc(status)}</span>
    </div>
    <p class="muted">${esc(b.date || "")} ${esc(b.time || "")}</p>
    <div class="caregiver-party">
      <p><strong>${t("booked_by") || "Booked by"}:</strong> ${esc(party.familyName)}</p>
      <p><strong>${t("senior") || "Senior"}:</strong> ${esc(party.seniorName)}
        ${party.seniorPhone ? ` · <a href="tel:+91${party.seniorPhone}">${esc(party.seniorPhone)}</a>` : ""}</p>
      ${party.address ? `<p class="muted"><i class="fa-solid fa-location-dot"></i> ${esc(party.address)}</p>` : ""}
    </div>
    ${cats}
    ${progress}
    ${b.notes ? `<p>${esc(b.notes)}</p>` : ""}
    <div class="row caregiver-call-row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
      ${party.familyPhone ? `<a class="btn btn-secondary btn-sm" href="tel:+91${String(party.familyPhone).replace(/\D/g,"")}"><i class="fa-solid fa-phone"></i> ${t("call_family") || "Call family"}</a>` : ""}
      ${party.seniorPhone ? `<a class="btn btn-secondary btn-sm" href="tel:+91${String(party.seniorPhone).replace(/\D/g,"")}"><i class="fa-solid fa-phone"></i> ${t("call_senior") || "Call senior"}</a>` : ""}
    </div>
    <div class="row caregiver-action-row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
      ${isNew ? `
        <button type="button" class="btn btn-primary btn-sm" onclick="caregiverAccept('${b.id}')">${t("accept") || "Accept"}</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="caregiverDecline('${b.id}')">${t("decline") || t("reject") || "Decline"}</button>
      ` : ""}
      ${status === "Accepted" || status === "In progress" ? `
        <button type="button" class="btn ${b.proofUrl ? "btn-secondary" : "btn-primary"} btn-sm" onclick="caregiverUploadProof('${b.id}')"><i class="fa-solid fa-camera"></i> ${b.proofUrl ? (t("change_photo") && t("change_photo") !== "Change Photo" ? t("change_photo") : "Change proof photo") : (t("upload_proof") || "Upload proof")}</button>
        <button type="button" class="btn ${b.proofUrl ? "btn-primary" : "btn-ghost"} btn-sm" ${b.proofUrl ? "" : 'aria-disabled="true" style="opacity:.55"'} onclick="caregiverMarkDone('${b.id}')">${t("mark_completed") || t("completed") || "Completed"}</button>
        ${b.proofUrl ? "" : `<p class="muted" style="width:100%;margin:4px 0 0"><i class="fa-solid fa-circle-info"></i> Proof photo is required to complete this task.</p>`}
      ` : ""}
      ${proofSrc ? `<img src="${proofSrc}" alt="proof" style="width:64px;height:64px;object-fit:cover;border-radius:8px;margin-top:6px">` : (b.proofUrl ? `<p class="muted">${t("proof_uploaded") || "Proof uploaded"}</p>` : "")}
    </div>
  </article>`;
}

function caregiverSosBanner() {
  return "";   // Helpers do not see SOS
  const sos = caregiverAssignedSos();
  if (!sos) return "";
  const maps = sos.mapsUrl || (sos.lat != null ? `https://www.google.com/maps?q=${sos.lat},${sos.lng}` : "");
  return `<div class="alert-banner sos-banner caregiver-sos">
    <strong>🚨 ${t("sos_from", { name: sos.seniorName || t("senior") }) || "SOS"}</strong>
    <p>${t("needs_help_now") || "Needs help right now"} · ${new Date(sos.timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      ${sos.seniorPhone ? `<a class="btn btn-primary btn-sm" href="tel:+91${String(sos.seniorPhone).replace(/\D/g,"")}">${t("call") || "Call"}</a>` : ""}
      ${maps ? `<a class="btn btn-secondary btn-sm" href="${esc(maps)}" target="_blank" rel="noopener">${t("open_map") || "Open map"}</a>` : ""}
    </div>
  </div>`;
}

function renderCaregiverHomeLocal() {
  const bookings = caregiverBookingsList();
  const pending = bookings.filter(b => (b.status || "Requested") === "Requested");
  const active = bookings.filter(b => ["Accepted", "In progress"].includes(b.status));
  const done = bookings.filter(b => b.status === "Completed");
  if (!bookings.length) {
    return `<main class="container helper-home">
      <div id="sos-slot"></div>
      ${caregiverSosBanner()}
      <section class="card hero">
        <h1>${t("welcome", { name: esc(session.user.name) })}</h1>
        <p class="muted">${t("helper_home_hint") || "Your booked tasks appear here."}</p>
      </section>
      <div class="empty card helper-empty">
        <div class="empty-icon"><i class="fa-solid fa-clipboard-list"></i></div>
        <h2>${t("no_bookings_short") || "No bookings yet"}</h2>
        <p class="muted">${t("helper_wait_booking") || "When a family books you, the task will show here."}</p>
      </div>
    </main>`;
  }
  return `<main class="container helper-home">
    <div id="sos-slot"></div>
    ${caregiverSosBanner()}
    <section class="card hero">
      <h1>${t("welcome", { name: esc(session.user.name) })}</h1>
      <p class="muted">${t("helper_home_hint") || "Your booked tasks appear here."}</p>
    </section>
    ${pending.length ? `<h2 class="section-title">${t("new_bookings") || "New bookings"}</h2>
      <div class="stack helper-stack">${pending.map(caregiverBookingCard).join("")}</div>` : ""}
    ${active.length ? `<h2 class="section-title">${t("active_tasks") || "Active tasks"}</h2>
      <div class="stack helper-stack">${active.map(caregiverBookingCard).join("")}</div>` : ""}
    ${done.length ? `<h2 class="section-title">${t("completed") || "Completed"}</h2>
      <div class="stack helper-stack">${done.map(caregiverBookingCard).join("")}</div>` : ""}
  </main>`;
}

function renderCaregiverSettingsLocal() {
  return `<main class="container helper-home">
    <h1>${t("settings")}</h1>
    <section class="card">
      <h2>${t("profile") || "Profile"}</h2>
      <p><strong>${esc(session.user.name)}</strong><br>+91 ${esc(session.user.phone)}</p>
      <p class="muted">${t("helper") || t("caregiver") || "Helper"}</p>
    </section>
    <section class="card section">
      <p class="muted">${t("return_login") || "Return to login to switch account."}</p>
      <button class="btn btn-primary" style="width:100%" onclick="logout()">${t("logout") || "Logout"}</button>
    </section>
  </main>`;
}

(function () {
  if (typeof roleNav !== "undefined") {
    roleNav.caregiver = [
      ["home", "home", "fa-house"],
      ["helpers", "my_tasks", "fa-list-check"],
      ["settings", "settings", "fa-gear"]
    ];
  }
  function ensureHelperNav() {
    if (typeof roleNav !== "undefined") {
      roleNav.caregiver = [
        ["home", "home", "fa-house"],
        ["helpers", "my_tasks", "fa-list-check"],
        ["settings", "settings", "fa-gear"]
      ];
    }
  }
  ensureHelperNav();
  setTimeout(ensureHelperNav, 0);

  window.renderCaregiver = function (root) {
    ensureHelperNav();
    root.className = "app-shell caregiver-mode mobile-app";
    let route = location.hash.replace("#/", "") || "home";
    if (route === "schemes" || route === "medicines" || route === "food" || route === "records" || route === "circle") {
      location.hash = "#/home";
      route = "home";
    }
    const nav = `<header class="topbar caregiver-bar">
      <div class="logo"><span class="logo-mark"><i class="fa-solid fa-heart"></i></span>${t("app_name")}</div>
      <button type="button" class="logout-btn" aria-label="${t("logout")||"Logout"}" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i></button>
    </header>`;
    let body = "";
    if (route === "settings") {
      body = renderCaregiverSettingsLocal();
    } else if (route === "helpers") {
      const bookings = caregiverBookingsList();
      body = `<main class="container">
        <h1>${t("my_tasks") || "My tasks"}</h1>
        ${caregiverSosBanner()}
        <div class="stack helper-stack">${bookings.length ? bookings.map(caregiverBookingCard).join("") : `<div class="empty card"><h2>${t("no_bookings_short") || "No bookings yet"}</h2><p class="muted">${t("helper_wait_booking") || "When a family books you, the task will show here."}</p></div>`}</div>
      </main>`;
    } else {
      body = renderCaregiverHomeLocal();
    }
    root.innerHTML = nav + body + `<nav class="bottom-nav">${(roleNav.caregiver || []).map(([r, key, icon]) =>
      `<button class="${route === r ? "active" : ""}" onclick="location.hash='#/${r}'"><i class="fa-solid ${icon || "fa-circle"}"></i><span>${t(key)}</span></button>`
    ).join("")}</nav>`;
    if (typeof injectSOS === "function") try { injectSOS(); } catch (e) {}
    if (typeof startCloudBookingsListener === "function") try { startCloudBookingsListener(); } catch (e) {}
  };
})();
