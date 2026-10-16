/* Seconds each family member has to respond before SOS moves to the next one */
var SOS_ROUND_SECONDS = 60;
/* ElderCare SOS — full-screen family alert, cascade, cross-tab */
let activeSOS = null;
let sosUnsubscribe = null;
let sosCascadeTimer = null;
let sosCountdownTimer = null;
let sosAlarmTimer = null;
let sosAlarmStopTimer = null;
let sosAudioCtx = null;
let sosAlarmGen = 0;
const SOS_KEY = "pendingSOSAlerts";
const SOS_BC_KEY = "sosBroadcast";
const sosChannel = (typeof BroadcastChannel !== "undefined") ? new BroadcastChannel("eldercare-sos") : null;
let lastKnownLocation = null;
let locationWatchId = null;

function cacheLastLocation(lat, lng) {
  if (lat == null || lng == null) return;
  lastKnownLocation = { lat: lat, lng: lng, time: Date.now() };
  try { localStorage.setItem("eldercareLastLocation", JSON.stringify(lastKnownLocation)); } catch (e) {}
  try {
    var ph = String((session && session.user && session.user.phone) || "").replace(/\D/g, "");
    if (ph) {
      var all = JSON.parse(localStorage.getItem("eldercareSeniorLocations") || "{}");
      all[ph] = lastKnownLocation;
      localStorage.setItem("eldercareSeniorLocations", JSON.stringify(all));
    }
  } catch (e) {}
}

function loadLastKnownLocation() {
  if (lastKnownLocation) return lastKnownLocation;
  try { lastKnownLocation = JSON.parse(localStorage.getItem("eldercareLastLocation") || "null"); } catch (e) { lastKnownLocation = null; }
  return lastKnownLocation;
}

function startLocationWatch() {
  if (!navigator.geolocation || locationWatchId != null) return;
  locationWatchId = setInterval(function () {
    if (!session || session.role !== "senior") return;
    function read() {
      navigator.geolocation.getCurrentPosition(
        function (p) { cacheLastLocation(p.coords.latitude, p.coords.longitude); },
        function (err) { console.warn("location refresh failed", err); },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
      );
    }
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then(function (st) {
        if (st.state === "granted") read();
      }).catch(function () {});
    }
  }, 180000);
}


function injectSOS() {
  if (!$(".senior-mode")) return;
  try { startLocationWatch(); } catch (e) {}
  // Seed last known location once if granted
  try {
    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then(function (st) {
        if (st.state === "granted") {
          navigator.geolocation.getCurrentPosition(
            function (p) { cacheLastLocation(p.coords.latitude, p.coords.longitude); },
            function (err) { console.warn("initial location failed", err); },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        }
      }).catch(function () {});
    }
  } catch (e) {}

  document.querySelectorAll(".floating-sos").forEach((el, i) => { if (i) el.remove(); });
  let b = $(".floating-sos");
  if (!b) {
    b = document.createElement("button");
    b.className = "floating-sos";
    document.body.append(b);
  }
  b.setAttribute("aria-label", t("sos") || "SOS");
  b.innerHTML = `<i class="fa-solid fa-bell"></i><span>${t("sos") || "SOS"}</span>`;
  b.onclick = triggerSOS;
}

function geo() {
  return new Promise(function (resolve) {
    function fallback() {
      var last = loadLastKnownLocation();
      if (last) return resolve({ lat: last.lat, lng: last.lng, fromCache: true });
      return resolve({ lat: null, lng: null });
    }
    function viaWeb() {
      if (!navigator.geolocation) return fallback();
      navigator.geolocation.getCurrentPosition(
        function (p) {
          cacheLastLocation(p.coords.latitude, p.coords.longitude);
          resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
        },
        function (err) {
          console.warn("getCurrentPosition failed", err);
          fallback();
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
      );
    }
    var G = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;
    if (G && G.getCurrentPosition) {
      G.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }).then(function (p) {
        cacheLastLocation(p.coords.latitude, p.coords.longitude);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      }).catch(function () { viaWeb(); });
    } else viaWeb();
  });
}

function mapsLink(lat, lng) {
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function primeSosAudio() {
  if (!isReceiverRole()) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!sosAudioCtx) sosAudioCtx = new Ctx();
    if (sosAudioCtx.state === "suspended") { const p = sosAudioCtx.resume(); if (p && p.catch) p.catch(function () {}); }
  } catch (e) {}
}

function unlockSosAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!sosAudioCtx) sosAudioCtx = new Ctx();
    if (sosAudioCtx.state === "suspended") { const p = sosAudioCtx.resume(); if (p && p.catch) p.catch(function () {}); }
  } catch (e) {}
}
["pointerdown", "touchstart", "click", "keydown"].forEach(function (ev) {
  document.addEventListener(ev, unlockSosAudio, { passive: true });
});

function startSosAlarm() {
  stopSosAlarm();
  if (!isReceiverRole()) return;   // senior device stays silent
  primeSosAudio();
  const gen = sosAlarmGen;
  function beep() {
    if (gen !== sosAlarmGen) return;   // this alarm was stopped / replaced
    if (!sosAudioCtx || sosAudioCtx.state !== "running") return;
    try {
      const o = sosAudioCtx.createOscillator();
      const g = sosAudioCtx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.09, sosAudioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, sosAudioCtx.currentTime + 0.28);
      o.connect(g);
      g.connect(sosAudioCtx.destination);
      o.start();
      o.stop(sosAudioCtx.currentTime + 0.3);
    } catch (e) {}
  }
  beep();
  sosAlarmTimer = setInterval(beep, 650);
  // never ring forever: stop by itself when this round ends
  sosAlarmStopTimer = setTimeout(stopSosAlarm, SOS_ROUND_SECONDS * 1000);
}

function stopSosAlarm() {
  sosAlarmGen++;
  if (sosAlarmTimer) { clearInterval(sosAlarmTimer); sosAlarmTimer = null; }
  if (sosAlarmStopTimer) { clearTimeout(sosAlarmStopTimer); sosAlarmStopTimer = null; }
  // keep the audio context open: it was unlocked by a tap, a fresh one would stay blocked (silent)
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {}
}
function sosMuteToken(key) { return key + "@" + String((session && session.user && session.user.phone) || "").replace(/\D/g, ""); }
function muteSosSound() {
  const k = document.getElementById("sos-family-overlay")?.dataset.key || "";
  window.__sosMutedKey = k;
  try { if (k) localStorage.setItem("sosMutedKey", sosMuteToken(k)); } catch (e) {}
  try { if (window.__sosPageNotif) window.__sosPageNotif.close(); } catch (e) {}
  stopSosAlarm();
  // also dismiss the system notification (its sound/vibration)
  try {
    const LN = (typeof capPlugin === "function") ? capPlugin("LocalNotifications") : null;
    if (LN && LN.removeAllDeliveredNotifications) LN.removeAllDeliveredNotifications();
  } catch (e) {}
  try {
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.getNotifications().then((list) => list.forEach((n) => { if (String(n.tag || "").indexOf("sos-") === 0) n.close(); })));
    }
  } catch (e) {}
}

function collectSosTargets(senior) {
  const list = [];
  const seen = new Set();
  function add(name, phone, role) {
    const p = String(phone || "").replace(/\D/g, "");
    if (!p || seen.has(p)) return;
    seen.add(p);
    list.push({ name: name || (role === "caregiver" ? t("helper") : t("family")), phone: p, role: role || "family" });
  }
  // SOS goes to family only — helpers are never alerted
  let __users = {};
  try { __users = JSON.parse(localStorage.getItem("eldercareLocalUsers") || "{}"); } catch (e) {}
  const __isHelperPhone = (p) => { const u = __users[String(p || "").replace(/\D/g, "")]; return !!(u && (u.role === "caregiver" || u.role === "helper")); };
  (senior?.emergencyContacts || []).forEach((c) => {
    if (/helper|caregiver/i.test(c.relationship || "") || __isHelperPhone(c.phone)) return;
    add(c.name, c.phone, "family");
  });
  try {
    const users = JSON.parse(localStorage.getItem("eldercareLocalUsers") || "{}");
    const sid = senior?.uid || ("local-" + String(senior?.phone || "").replace(/\D/g, ""));
    Object.values(users).forEach((u) => {
      if (!u || u.role === "senior" || u.role === "caregiver" || u.role === "helper") return;
      const linked = u.linkedSeniorIds || [];
      const phones = (u.linkedSeniors || []).map((s) => String(s.phone || s).replace(/\D/g, ""));
      if (linked.includes(sid) || phones.includes(String(senior?.phone || "").replace(/\D/g, ""))) {
        add(u.name, u.phone, u.role);
      }
    });
  } catch (e) {}
  // Demo fallback so two-tab testing always has a family target
  if (!list.length && String(senior?.phone || "").replace(/\D/g, "") === "9000000001") add("Priya", "9000000002", "family");
  const helper = list.find((x) => x.role === "caregiver" || x.role === "helper");
  const familyFirst = list.filter((x) => x.role === "family");
  const rest = list.filter((x) => x.role !== "family" && x !== helper);
  return [...familyFirst, ...(helper ? [helper] : []), ...rest];
}

function writeSos(alert) {
  localStorage.setItem(SOS_KEY, JSON.stringify([alert]));
  localStorage.setItem(SOS_BC_KEY, JSON.stringify({ id: alert.id, at: Date.now(), status: alert.status, targetIndex: alert.targetIndex }));
  try { sosChannel?.postMessage({ type: "sos", alert }); } catch (e) {}
  cloudSosSet(alert);
}

/* ---------- Cloud sync (Firestore) so SOS reaches other phones ---------- */
function sosDb() { try { return (typeof db !== "undefined" && db) ? db : null; } catch (e) { return null; } }
function cloudSosSet(alert) {
  const d = sosDb();
  if (!d || !alert || !alert.seniorPhone) return;
  const clean = JSON.parse(JSON.stringify(alert));
  delete clean._cloud;
  d.collection("sosAlerts").doc(String(alert.seniorPhone)).set(clean).catch((e) => console.warn("cloud sos set", e));
}
function cloudSosDelete(phone) {
  const d = sosDb();
  if (!d || !phone) return;
  d.collection("sosAlerts").doc(String(phone)).delete().catch((e) => console.warn("cloud sos delete", e));
}
function sosSig(a) { return a ? [a.id, a.status, a.targetIndex, a.roundStartedAt, a.lat, a.lng, a.respondedBy, (a.rejectedBy || []).join(",")].join("|") : ""; }
var cloudSosUnsub = null, cloudSosFor = "";
function startCloudSosListener() {
  const d = sosDb();
  if (!d || !session?.user) return;
  const me = String(session.user.phone || "").replace(/\D/g, "");
  if (!me || (cloudSosUnsub && cloudSosFor === me)) return;
  if (cloudSosUnsub) { try { cloudSosUnsub(); } catch (e) {} }
  cloudSosFor = me;
  cloudSosUnsub = d.collection("sosAlerts").onSnapshot((snap) => {
    let found = null;
    snap.forEach((doc) => {
      const a = doc.data();
      if (!a || (a.status !== "active" && a.status !== "responding")) return;
      if (a.seniorPhone === me || (a.targets || []).some((x) => x.phone === me)) found = a;
    });
    const local = readActiveSos();
    if (found) {
      if (!local || sosSig(local) !== sosSig(found)) {
        localStorage.setItem(SOS_KEY, JSON.stringify([{ ...found, _cloud: true }]));
        pollLocalSOSForFamily();
      }
    } else if (local && local._cloud) {
      localStorage.setItem(SOS_KEY, "[]");
      stopSosAlarm();
      hideFamilySOSOverlay();
      hideAcceptedSOSCard();
      document.querySelector(".modal-backdrop.sos-modal")?.remove();
    }
  }, (err) => console.warn("cloud sos listen", err));
}

const PUSH_TOKENS_KEY = "eldercarePushTokens";

function loadPushTokens() {
  try { return JSON.parse(localStorage.getItem(PUSH_TOKENS_KEY) || "{}"); } catch (e) { return {}; }
}
function savePushTokenForUser(phone, token) {
  if (!phone || !token) return;
  const map = loadPushTokens();
  map[String(phone).replace(/\D/g, "")] = { token, at: Date.now() };
  localStorage.setItem(PUSH_TOKENS_KEY, JSON.stringify(map));
  try {
    const users = JSON.parse(localStorage.getItem("eldercareLocalUsers") || "{}");
    const key = String(phone).replace(/\D/g, "");
    if (users[key]) {
      users[key].pushToken = token;
      localStorage.setItem("eldercareLocalUsers", JSON.stringify(users));
    }
  } catch (e) {}
}

async function registerPushToken() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const phone = session?.user?.phone;
  if (!phone) return;
  // Prefer FCM if messaging SDK is loaded
  try {
    if (window.firebase && firebase.messaging) {
      const messaging = firebase.messaging();
      // VAPID may not be configured; still attempt
      const token = await messaging.getToken().catch(() => null);
      if (token) {
        savePushTokenForUser(phone, token);
        return token;
      }
    }
  } catch (e) {}
  // Fallback token for local/SW-delivered notifications
  const localTok = "local-" + String(phone).replace(/\D/g, "") + "-" + (navigator.userAgent || "").slice(0, 12);
  savePushTokenForUser(phone, localTok);
  // Ensure SW can show notifications
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "register-token", phone: String(phone).replace(/\D/g, ""), token: localTok });
  }
  return localTok;
}

async function notifyFamilyPush(alert) {
  if (!isReceiverRole()) return;   // only family / helper get the alert sound
  // app open AND audio unlocked: the in-app alarm is enough (avoids a second sound); otherwise keep the notification so it is never silent
  if (document.visibilityState === "visible" && sosAudioCtx && sosAudioCtx.state === "running") return;
  // Ask browser notification dialog only when still "default" and SOS is active
  // Permissions are asked once at start (see requestStartupPermissions); never here.
  const title = (t("sos_from", { name: alert.seniorName || t("senior") }) || ("SOS: " + (alert.seniorName || "Senior")));
  const timeStr = new Date(alert.timestamp || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const body = (t("needs_help_now") || "Needs help right now") + " · " + timeStr;
  const payload = {
    title,
    body,
    tag: "sos-" + (alert.id || "active"),
    data: { type: "sos", alertId: alert.id, seniorName: alert.seniorName, mapsUrl: alert.mapsUrl || "" },
    requireInteraction: true,
    renotify: true
  };

  // 0) Installed Android app: native notification with sound
  const LN = (typeof capPlugin === "function") ? capPlugin("LocalNotifications") : null;
  if (LN) {
    try {
      await LN.createChannel({ id: "sos", name: "SOS alerts", description: "Emergency alerts", importance: 5, visibility: 1, vibration: true });
      await LN.schedule({ notifications: [{ id: Math.floor(Date.now() % 2000000000), title, body, channelId: "sos" }] });
    } catch (e) { console.warn("native notification", e); }
    return;
  }

  // 1) Service worker system notification (works in background tab)
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "show-sos-notification", notification: payload });
  } else if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        tag: payload.tag,
        icon: "assets/icons/icon-192.png",
        badge: "assets/icons/icon-192.png",
        requireInteraction: true,
        renotify: true,
        vibrate: [200, 100, 200, 100, 200],
        data: payload.data,
        actions: [{ action: "open", title: t("open_map") || "Open" }]
      }).catch(() => {});
    });
  }

  // 2) Page Notification API (foreground)
  if (!navigator.serviceWorker && "Notification" in window && Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        tag: payload.tag,
        icon: "assets/icons/icon-192.png",
        requireInteraction: true,
        renotify: true,
        silent: false
      });
      window.__sosPageNotif = n;
      n.onclick = () => {
        window.focus();
        location.hash = "#/home";
        n.close();
        if (typeof showFamilySOSOverlay === "function") showFamilySOSOverlay(alert);
      };
    } catch (e) {}
  }
}

function readActiveSos() {
  try {
    const arr = JSON.parse(localStorage.getItem(SOS_KEY) || "[]");
    return arr.find((a) => a.status === "active" || a.status === "responding") || null;
  } catch (e) { return null; }
}

function clearSosStorage() {
  try { const cur = readActiveSos(); if (cur) cloudSosDelete(cur.seniorPhone); } catch (e) {}
  localStorage.setItem(SOS_KEY, "[]");
  localStorage.removeItem(SOS_BC_KEY);
  localStorage.removeItem("activeSOS");
  try { sosChannel?.postMessage({ type: "clear" }); } catch (e) {}
}

function isReceiverRole() {
  // Senior page / senior account is never a receiver: no alarm, no notification, no overlay
  if (document.querySelector(".senior-mode")) return false;
  // Helpers never receive SOS (no alarm, no notification, no overlay)
  if (session?.role && ["caregiver", "helper"].includes(String(session.role).toLowerCase())) return false;
  return session?.user && session.role && String(session.role).toLowerCase() !== "senior";
}

function sosNameForTarget(tg) {
  if (!tg) return "";
  try {
    const users = JSON.parse(localStorage.getItem("eldercareLocalUsers") || "{}");
    const u = users[String(tg.phone || "").replace(/\D/g, "")];
    if (u && u.name) return u.name;
  } catch (e) {}
  return tg.name || "";
}
/* Index of the next family member who has not rejected this SOS (-1 if none) */
function nextIndex(alert) {
  const targets = alert.targets || [];
  const rejected = alert.rejectedBy || [];
  for (let i = 1; i <= targets.length; i++) {
    const j = ((alert.targetIndex || 0) + i) % targets.length;
    if (rejected.indexOf(targets[j].phone) < 0) return j;
  }
  return -1;
}
function nextTarget(alert) {
  const targets = alert.targets || [];
  if (targets.length < 2) return null;
  const j = nextIndex(alert);
  return (j < 0 || j === (alert.targetIndex || 0)) ? null : targets[j];
}
function currentTarget(alert) {
  const targets = alert.targets || [];
  if (!targets.length) return null;
  return targets[(alert.targetIndex || 0) % targets.length];
}

function receiverShouldSee(alert) {
  if (!isReceiverRole() || !alert || alert.status !== "active") return false;
  const me = String(session.user.phone || "").replace(/\D/g, "");
  if ((alert.rejectedBy || []).indexOf(me) >= 0) return false;
  try { if (localStorage.getItem("sosRejected:" + alert.id + "@" + me)) return false; } catch (e) {}   // sticky on this device even if the cloud copy is stale
  if (alert.seniorPhone && alert.seniorPhone === me) return false;
  const tgt = currentTarget(alert);
  if (!tgt) return true;
  // Show to the current cascade target; if phone unknown, all family/helpers see it
  return !tgt.phone || tgt.phone === me;
}

function showFamilySOSOverlay(alert) {
  if (!receiverShouldSee(alert)) {
    hideFamilySOSOverlay();
    return;
  }
  // System notification only for the person whose turn it is (once per round)
  const roundKey = alert.id + ":" + (alert.targetIndex || 0);
  if (window.__sosNotifiedRound !== roundKey) {
    window.__sosNotifiedRound = roundKey;
    try { notifyFamilyPush(alert); } catch (e) {}
  }
  let maps = alert.mapsUrl || mapsLink(alert.lat, alert.lng);
  if (!maps) {
    try {
      const all = JSON.parse(localStorage.getItem("eldercareSeniorLocations") || "{}");
      const l = all[String(alert.seniorPhone || "").replace(/\D/g, "")];
      if (l) { maps = mapsLink(l.lat, l.lng); alert = { ...alert, locationTime: l.time }; }
    } catch (e) {}
  }
  const tgt = currentTarget(alert);
  const remaining = Math.max(0, SOS_ROUND_SECONDS - Math.floor(((Date.now() - (alert.roundStartedAt || alert.timestamp || Date.now())) / 1000)));
  const mapHTML = maps
    ? `<a class="btn btn-maps sos-map-btn" href="${esc(maps)}" target="_blank" rel="noopener"><i class="fa-solid fa-location-dot"></i> ${t("open_map") || "Open in Maps"}</a>${alert.locationTime ? `<p class="muted">` + new Date(alert.locationTime).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) + `</p>` : ""}`
    : ((alert.locationStatus === "unavailable" || (Date.now() - (alert.timestamp || Date.now()) > 30000))
        ? `<p class="muted">${t("location_unavailable") || "Location unavailable"}</p>`
        : `<p class="muted">${t("location_wait") || "Waiting for location…"}</p>`);
  const nxt = nextTarget(alert);
  const cascadeHTML = nxt
    ? `${t("notifying") || "Notifying"}: <strong>${esc(sosNameForTarget(nxt))}</strong> · ${remaining}s`
    : `${t("notifying") || "Notifying"}: <strong>${esc(sosNameForTarget(tgt) || t("family"))}</strong> · ${remaining}s`;
  const key = alert.id + "|" + (alert.targetIndex || 0);

  let host = document.getElementById("sos-family-overlay");
  // Same alert already on screen: only refresh the changing bits. Never rebuild the
  // buttons, otherwise Accept / Map taps get lost while the card is redrawn.
  if (host && host.dataset.key === key) {
    const slot = host.querySelector("#sos-map-slot");
    if (slot && slot.dataset.v !== mapHTML) { slot.innerHTML = mapHTML; slot.dataset.v = mapHTML; }
    const line = host.querySelector(".sos-cascade-line");
    if (line) line.innerHTML = cascadeHTML;
    return;
  }
  if (!host) {
    host = document.createElement("div");
    host.id = "sos-family-overlay";
    host.className = "sos-family-overlay";
    (document.getElementById("app")||document.body).append(host);
  }
  host.dataset.key = key;
  primeSosAudio();
  if (window.__sosMutedKey !== key && localStorage.getItem("sosMutedKey") !== sosMuteToken(key)) startSosAlarm();
  host.innerHTML = `
    <div class="sos-family-card">
      <div class="sos-pulse">SOS</div>
      <h1>${t("sos_from", { name: esc(alert.seniorName || t("senior")) }) || ("SOS: " + esc(alert.seniorName))}</h1>
      <p class="sos-need">${t("needs_help_now") || "Needs help right now"}</p>
      <div id="sos-map-slot" data-v="${esc(mapHTML)}">${mapHTML}</div>
      ${alert.seniorPhone ? `<a class="btn btn-secondary" href="tel:${esc(alert.seniorPhone)}">${t("call") || "Call"} ${esc(alert.seniorName || "")}</a>` : ""}
      <p class="muted sos-cascade-line">${cascadeHTML}</p>
      <div class="sos-family-actions">
        <button type="button" class="btn btn-primary" id="sos-accept">${t("accept") || "Accept"}</button>
        <button type="button" class="btn btn-ghost" id="sos-reject">${t("reject") || "Reject"}</button>
      </div>
      <button type="button" class="btn btn-ghost" id="sos-mute"><i class="fa-solid fa-volume-xmark"></i> ${t("stop_sound") || "Stop sound"}</button>
    </div>`;
  document.getElementById("sos-accept").onclick = () => acceptSOS(alert);
  document.getElementById("sos-reject").onclick = () => rejectSOS(alert);
  document.getElementById("sos-mute").onclick = (ev) => { muteSosSound(); ev.currentTarget.style.display = "none"; };
}

function hideFamilySOSOverlay() {
  stopSosAlarm();
  document.getElementById("sos-family-overlay")?.remove();
}
function hideAcceptedSOSCard() { document.getElementById("sos-accepted-overlay")?.remove(); }

function acceptSOS(alert) {
  muteSosSound();
  clearTimeout(sosCascadeTimer);
  clearInterval(sosCountdownTimer);
  const updated = {
    ...alert,
    status: "responding",
    respondedBy: session.user?.uid,
    responderName: session.user?.name,
    responderPhone: session.user?.phone
  };
  writeSos(updated);
  if (activeSOS && activeSOS.id === alert.id) activeSOS = updated;
  hideFamilySOSOverlay();
  const maps = updated.mapsUrl || mapsLink(updated.lat, updated.lng);
  const done = document.createElement("div");
  document.getElementById("sos-accepted-overlay")?.remove();
  done.id = "sos-accepted-overlay";
  done.className = "sos-family-overlay sos-accepted";
  done.innerHTML = `<div class="sos-family-card">
    <div class="sos-pulse ok">✓</div>
    <h1>${t("you_are_responding") || "You are responding"}</h1>
    <p>${esc(updated.seniorName || "")}</p>
    ${maps ? `<a class="btn btn-maps" href="${esc(maps)}" target="_blank" rel="noopener">${t("open_map") || "Open Map"}</a>` : ""}
    <button type="button" class="btn btn-secondary" id="sos-ack-close">${t("close") || "Close"}</button>
  </div>`;
  document.body.append(done);
  document.getElementById("sos-ack-close").onclick = () => done.remove();
  toast(t("responding_toast") || "Responding");
}

function rejectSOS(alert) {
  muteSosSound();
  hideFamilySOSOverlay();
  const live = readActiveSos();
  const cur = (live && live.id === alert.id) ? live : alert;
  if (!cur || cur.status !== "active") return;
  const me = String(session.user?.phone || "").replace(/\D/g, "");
  try { localStorage.setItem("sosRejected:" + cur.id + "@" + me, "1"); } catch (e) {}
  const rejectedBy = Array.from(new Set([...(cur.rejectedBy || []), me]));
  const withMe = { ...cur, rejectedBy: rejectedBy };
  const j = nextIndex(withMe);
  const next = { ...withMe, targetIndex: j < 0 ? (cur.targetIndex || 0) : j, roundStartedAt: Date.now(), status: "active" };
  writeSos(next);
  scheduleCascade(next);
}

function advanceCascade(alert) {
  if (!alert || alert.status !== "active") return;
  const next = { ...alert, targetIndex: alert.targetIndex || 0, roundStartedAt: Date.now(), status: "active" };
  writeSos(next);
  scheduleCascade(next);
}

function scheduleCascade(alert) {
  clearTimeout(sosCascadeTimer);
  clearInterval(sosCountdownTimer);
  sosCountdownTimer = setInterval(() => {
    const live = readActiveSos();
    if (!live || live.status !== "active") { clearInterval(sosCountdownTimer); return; }
    if (isReceiverRole()) showFamilySOSOverlay(live);
    const seniorState = document.getElementById("sos-cascade-status");
    if (seniorState) {
      const tgt = currentTarget(live);
      seniorState.textContent = (t("notifying") || "Notifying") + " " + (sosNameForTarget(tgt) || "") + "…";
    }
  }, 400);
  const tick = () => {
    const live = readActiveSos();
    if (!live || live.status !== "active") return;
    const left = SOS_ROUND_SECONDS * 1000 - (Date.now() - (live.roundStartedAt || 0));
    if (left > 800) { sosCascadeTimer = setTimeout(tick, left); return; }   // another phone already moved on
    const nj = nextIndex(live);
    live.targetIndex = nj < 0 ? (live.targetIndex || 0) : nj;
    live.roundStartedAt = Date.now();
    writeSos(live);
    scheduleCascade(live);
  };
  sosCascadeTimer = setTimeout(tick, SOS_ROUND_SECONDS * 1000);
}

async function triggerSOS() {
  // Senior device stays silent — no alarm, no vibration on this side
  if (!session.user) { toast(t("sos_login") || "Please sign in", true); return; }
  muteSosSound();   // senior side: make sure nothing rings or is notified here
  var existing = readActiveSos();
  var myId = session.user.uid || ("local-" + String(session.user.phone || "").replace(/\D/g, ""));
  if (existing && existing.status === "active" && existing.seniorId === myId) {
    activeSOS = existing;
    showSOSOverlay(existing);
    return;
  }
  var b = $(".floating-sos");
  if (b) b.innerHTML = "<span>…</span>";

  var seniorNow = session.user;
  try {   // use the freshest contact list (family may have linked since login)
    var d0 = sosDb();
    if (d0 && session.user.uid && String(session.user.uid).indexOf("local-") !== 0) {
      var snap0 = await Promise.race([d0.collection("users").doc(session.user.uid).get(), new Promise(function(_, rej) { setTimeout(rej, 1200); })]);
      if (snap0 && snap0.exists) seniorNow = Object.assign({}, session.user, { emergencyContacts: snap0.data().emergencyContacts || session.user.emergencyContacts });
    }
  } catch (e) {}
  var targets = collectSosTargets(seniorNow);
  var last = typeof loadLastKnownLocation === "function" ? loadLastKnownLocation() : null;
  var payload = {
    id: "local-" + Date.now(),
    seniorId: myId,
    seniorName: session.user.name,
    seniorPhone: String(session.user.phone || "").replace(/\D/g, ""),
    lat: last ? last.lat : null,
    lng: last ? last.lng : null,
    mapsUrl: last ? mapsLink(last.lat, last.lng) : "",
    locationStatus: last ? "cached" : "pending",
    locationTime: last ? last.time : null,
    message: "SOS",
    status: "active",
    targets: targets,
    targetIndex: 0,
    timestamp: Date.now(),
    roundStartedAt: Date.now(),
    respondedBy: null,
    responderName: null
  };
  activeSOS = payload;
  localStorage.setItem("activeSOS", JSON.stringify(payload));
  writeSos(payload);
  showSOSOverlay(payload);
  scheduleCascade(payload);
  if (b) b.innerHTML = '<i class="fa-solid fa-bell"></i><span>' + (t("sos") || "SOS") + "</span>";
  toast(t("help_on_way") || "Help is on the way. Your family has been alerted.");

  geo().then(function(loc) {
    var live = readActiveSos();
    if (!live || live.id !== payload.id) return;
    if (loc.lat != null) {
      live.lat = loc.lat;
      live.lng = loc.lng;
      live.mapsUrl = mapsLink(loc.lat, loc.lng);
      live.locationStatus = loc.fromCache ? "cached" : "live";
      live.locationTime = Date.now();
      writeSos(live);
      activeSOS = live;
    } else {
      live.locationStatus = "unavailable";
      writeSos(live);
      activeSOS = live;
    }
  });
}

function showSOSOverlay(alert) {
  document.querySelector(".modal-backdrop.sos-modal")?.remove();
  const a = alert || activeSOS || readActiveSos();
  const tgt = a ? currentTarget(a) : null;
  const responding = a && a.status === "responding";
  const b = document.createElement("div");
  b.className = "modal-backdrop sos-modal";
  b.innerHTML = `<div class="modal sos-senior-modal">
    <div class="modal-handle"></div>
    <div id="sos-state">
      ${responding
        ? `<div class="sos-pulse ok">✓</div>
           <h1>${t("is_coming", { name: esc(a.responderName || t("family")) }) || (esc(a.responderName) + " is coming")}</h1>
           <p>${t("stay_calm") || "Stay calm"}</p>`
        : `<div class="sos-pulse ok">✓</div>
           <h1>${String(t("help_on_way") || "Help is on the way").split(/[.।]/)[0]}</h1>
           <p>${t("family_notified") || "Your family has been alerted."}</p>
           <p id="sos-cascade-status" class="muted">${t("notifying") || "Notifying"} ${esc(sosNameForTarget(tgt) || t("family"))}…</p>`}
      <button type="button" class="btn btn-secondary" id="resolve-sos" style="width:100%;margin-top:16px">${t("cancel_alert") || "Cancel alert"}</button>
    </div>
  </div>`;
  (document.getElementById("app")||document.body).append(b);
  $("#resolve-sos").onclick = resolveSOS;
}

function resolveSOS() {
  clearTimeout(sosCascadeTimer);
  clearInterval(sosCountdownTimer);
  stopSosAlarm();
  clearSosStorage();
  document.querySelector(".modal-backdrop.sos-modal")?.remove();
  hideFamilySOSOverlay();
  hideAcceptedSOSCard();
  activeSOS = null;
  toast(t("sos_cancelled") || "SOS cancelled");
}

function pollLocalSOSForFamily() {
  const live = readActiveSos();
  if (!live) { hideFamilySOSOverlay(); hideAcceptedSOSCard(); return; }
  if (isReceiverRole()) {
    if (live.status === "active") showFamilySOSOverlay(live);
    else if (live.status === "responding") hideFamilySOSOverlay();
  }
  if (session?.role === "senior" && live.status === "responding") {
    const el = document.getElementById("sos-state");
    if (el && !el.querySelector(".sos-pulse.ok")) showSOSOverlay(live);
  }
}

function listenForCaregiverSOS() { pollLocalSOSForFamily(); }
function showCaregiverSOS(a) { if (a) showFamilySOSOverlay(a); }

function handleSosMessage(alert) {
  if (!alert) { pollLocalSOSForFamily(); return; }
  if (session?.role === "senior" && alert.status === "responding") {
    showSOSOverlay(alert);
    return;
  }
  if (isReceiverRole()) {
    if (alert.status === "active") showFamilySOSOverlay(alert);
    else hideFamilySOSOverlay();
  }
}

setInterval(() => {
  if (session?.user) { startCloudSosListener(); pollLocalSOSForFamily(); }
}, 1000);

window.addEventListener("storage", (e) => {
  if (e.key === SOS_KEY || e.key === SOS_BC_KEY) pollLocalSOSForFamily();
  if (e.key === "sosMutedKey") {   // Stop sound pressed in another tab of the same account
    const h = document.getElementById("sos-family-overlay");
    if (h && e.newValue === sosMuteToken(h.dataset.key)) { window.__sosMutedKey = h.dataset.key; stopSosAlarm(); }
  }
});

sosChannel?.addEventListener("message", (ev) => {
  if (ev.data?.type === "clear") {
    hideFamilySOSOverlay();
    hideAcceptedSOSCard();
    document.querySelector(".modal-backdrop.sos-modal")?.remove();
    return;
  }
  if (ev.data?.type === "sos") handleSosMessage(ev.data.alert);
});

// Audio is primed only on family/helper receiver side inside showFamilySOSOverlay
window.addEventListener("hashchange", () => { if (session?.user) pollLocalSOSForFamily(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !isReceiverRole()) return;
  try {   // app is open again: drop the system notification so it cannot ring a second time
    const LN = (typeof capPlugin === "function") ? capPlugin("LocalNotifications") : null;
    if (LN && LN.removeAllDeliveredNotifications) LN.removeAllDeliveredNotifications();
  } catch (e) {}
  try { if (window.__sosPageNotif) window.__sosPageNotif.close(); } catch (e) {}
  try {
    if (navigator.serviceWorker?.ready) navigator.serviceWorker.ready.then((reg) => reg.getNotifications().then((list) => list.forEach((n) => { if (String(n.tag || "").indexOf("sos-") === 0) n.close(); })));
  } catch (e) {}
});
