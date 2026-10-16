const session = { user: null, role: null, senior: null };

/* —— Local (offline) accounts — works without Firebase / file:// —— */
const LOCAL_USERS_KEY = "eldercareLocalUsers";
function loadLocalUsers() {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "{}"); } catch (e) { return {}; }
}
function saveLocalUsers(map) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(map));
}
function localUserKey(phone) {
  return String(phone || "").replace(/\D/g, "");
}
function hashPass(pw) {
  // lightweight non-crypto hash for demo offline auth only
  let h = 0;
  const s = String(pw || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return "h" + h;
}
function makeLocalUser(data) {
  const phone = localUserKey(data.phone);
  const user = {
    uid: "local-" + phone,
    phone,
    name: data.name || "User",
    role: data.role || "senior",
    passwordHash: hashPass(data.password),
    linkedSeniorIds: data.linkedSeniorIds || [],
    linkedSeniors: data.linkedSeniors || [],
    emergencyContacts: data.emergencyContacts || [],
    language: data.language || localStorage.getItem("language") || "en",
    healthConditions: data.healthConditions || ""
  };
  if (data.helperId) user.helperId = data.helperId;
  if (data.linkedSeniorPhone) user.linkedSeniorPhone = data.linkedSeniorPhone;
  if (data.family) user.family = data.family;
  if (data.caregivers) user.caregivers = data.caregivers;
  return user;
}
function getLocalUser(phone) {
  return loadLocalUsers()[localUserKey(phone)] || null;
}
function putLocalUser(user) {
  const map = loadLocalUsers();
  map[localUserKey(user.phone)] = user;
  saveLocalUsers(map);
}
function startLocalSession(user) {
  window.__eldercareLoggedOut = false;
  let safe = { ...(user || {}) };
  delete safe.passwordHash;
  try {
    if (typeof normalizeLinkedSeniors === "function") safe = normalizeLinkedSeniors(safe);
  } catch (e) { console.warn("normalizeLinkedSeniors", e); }
  if (!safe.role) safe.role = "senior";
  currentUser = safe;
  currentRole = safe.role;
  session.user = safe;
  session.role = safe.role;
  try { sessionStorage.setItem("eldercareSession", JSON.stringify(safe)); } catch (e) {}
  try { localStorage.setItem("lastPhone", safe.phone || ""); } catch (e) {}
  bootApp();
}

let currentUser = null, currentRole = null;

/* ===================================================================
   CLOUD SYNC (so the same data shows on every phone you log in from)
   Every login — local or Firebase — is also signed in to Firebase Auth
   in the background, so Firestore reads/writes are allowed.
   Links between family/helper and senior are stored by PHONE NUMBER in
   Firestore "seniorLinks/<seniorPhone>", which works on any device.
   =================================================================== */
function ecDigits(p) { return String(p || "").replace(/\D/g, ""); }
function ecHelperIdForPhone(phone) {
  const p = ecDigits(phone);
  try {
    const list = (typeof HELPER_PROFILES !== "undefined" && HELPER_PROFILES) || [];
    const h = list.find(x => ecDigits(x.phone) === p);
    if (h) return h.id;
  } catch (e) {}
  return ({ "9000000003": "h0", "9000000011": "h1", "9000000012": "h2", "9000000013": "h3", "9000000014": "h4" })[p] || "";
}
async function ensureCloudAccount(user, password) {
  if (typeof auth === "undefined" || !auth || !user || !user.phone || !password) return null;
  const phone = ecDigits(user.phone);
  const email = phoneToAuthEmail(phone);
  window.__ecBgAuth = true;
  try {
    let cu = auth.currentUser;
    if (!cu || (cu.email || "") !== email) {
      cu = null;
      try {
        cu = (await auth.signInWithEmailAndPassword(email, password)).user;
      } catch (err) {
        const c = (err && err.code) || "";
        if (c === "auth/user-not-found" || c === "auth/invalid-credential" || c === "auth/invalid-login-credentials") {
          try { cu = (await auth.createUserWithEmailAndPassword(email, password)).user; }
          catch (e2) { console.warn("cloud account create", e2 && e2.code); }
        } else console.warn("cloud sign-in", c || err);
      }
      // Last resort so Firestore still works (needs "Anonymous" sign-in enabled in Firebase)
      if (!cu) { try { cu = (await auth.signInAnonymously()).user; } catch (e3) {} }
    }
    if (!cu) return null;
    if (db && !cu.isAnonymous) {
      const profile = { phone, name: user.name || "", role: user.role || "senior", language: localStorage.getItem("language") || "en" };
      const hid = user.helperId || (user.role === "caregiver" ? ecHelperIdForPhone(phone) : "");
      if (hid) profile.helperId = hid;
      try {
        await db.collection("users").doc(cu.uid).set(profile, { merge: true });
        await db.collection("phones").doc(phone).set({ uid: cu.uid, role: profile.role, name: profile.name }, { merge: true });
      } catch (e) { console.warn("cloud profile write", e && e.code); }
    }
    window.__ecCloudUid = cu.uid;
    return cu;
  } finally {
    window.__ecBgAuth = false;
  }
}
window.ensureCloudAccount = ensureCloudAccount;

async function ecSaveLinkToCloud(seniorPhone, seniorName) {
  if (!db || !session.user) return;
  const sp = ecDigits(seniorPhone), me = ecDigits(session.user.phone);
  if (!sp || !me) return;
  const FV = firebase.firestore.FieldValue;
  const member = { phone: me, name: session.user.name || "", role: session.role === "family" ? "family" : "caregiver" };
  const data = { seniorPhone: sp, members: FV.arrayUnion(member), memberPhones: FV.arrayUnion(me), updatedAt: Date.now() };
  if (seniorName) data.seniorName = seniorName;
  await db.collection("seniorLinks").doc(sp).set(data, { merge: true });
}

function ecPersistSessionUser() {
  try { sessionStorage.setItem("eldercareSession", JSON.stringify(session.user)); } catch (e) {}
  try {
    const local = getLocalUser(session.user.phone);
    if (local) {
      ["linkedSeniors", "linkedSeniorIds", "linkedSeniorPhone", "emergencyContacts", "helperId"].forEach(k => {
        if (session.user[k] !== undefined) local[k] = session.user[k];
      });
      putLocalUser(local);
    }
  } catch (e) {}
}

/** Pull links from Firestore (any phone) and push this device's old links up. */
async function ecSyncLinksFromCloud() {
  if (!db || !session.user) return;
  const me = ecDigits(session.user.phone);
  if (!me) return;
  let changed = false;
  if (session.role === "senior") {
    // Senior side unchanged: SOS contacts work exactly as in the original app
  } else {
    const snap = await db.collection("seniorLinks").where("memberPhones", "array-contains", me).get();
    const list = (session.user.linkedSeniors || []).filter(s => s && typeof s === "object").slice();
    const inCloud = new Set();
    snap.forEach(d => {
      const x = d.data() || {};
      const p = ecDigits(x.seniorPhone || d.id);
      if (!p) return;
      inCloud.add(p);
      const ex = list.find(s => ecDigits(s.phone) === p);
      if (!ex) { list.push({ uid: "local-" + p, phone: p, name: x.seniorName || "Senior" }); changed = true; }
      else if ((!ex.name || ex.name === "Senior") && x.seniorName) { ex.name = x.seniorName; changed = true; }
    });
    // Links made on this phone before cloud sync existed → upload them once
    list.forEach(s => { const p = ecDigits(s.phone); if (p && !inCloud.has(p)) ecSaveLinkToCloud(p, s.name).catch(() => {}); });
    if (changed) {
      session.user.linkedSeniors = list;
      session.user.linkedSeniorIds = [...new Set([...(session.user.linkedSeniorIds || []), ...list.map(s => s.uid).filter(Boolean)])];
      if (!session.user.linkedSeniorPhone && list[0]) session.user.linkedSeniorPhone = list[0].phone;
    }
  }
  if (changed) {
    ecPersistSessionUser();
    try { if (typeof reloadMedicinesForSession === "function") reloadMedicinesForSession(); } catch (e) {}
    try { window.ecMedsCloudRestart && window.ecMedsCloudRestart(); } catch (e) {}
    try { window.ecRecordsCloudRestart && window.ecRecordsCloudRestart(); } catch (e) {}
    if (typeof render === "function") render();
  }
}
window.ecSyncLinksFromCloud = ecSyncLinksFromCloud;

/** (Re)start every Firestore listener — called after the background sign-in finishes. */
window.ecRestartCloud = function () {
  if (!session.user) return;
  try { if (typeof stopCloudBookingsListener === "function") { stopCloudBookingsListener(); startCloudBookingsListener(); } } catch (e) {}
  try {
    if (typeof cloudSosUnsub !== "undefined" && cloudSosUnsub) { try { cloudSosUnsub(); } catch (e) {} cloudSosUnsub = null; cloudSosFor = ""; }
    if (typeof startCloudSosListener === "function") startCloudSosListener();
  } catch (e) {}
  try { window.ecMedsCloudRestart && window.ecMedsCloudRestart(); } catch (e) {}
  try { window.ecRecordsCloudRestart && window.ecRecordsCloudRestart(); } catch (e) {}
  ecSyncLinksFromCloud().catch(e => console.warn("link sync", e && e.code));
};
function roleLabel(role) {
  return role === "caregiver" || role === "helper" ? (t("helper") || "Helper") : role === "family" ? t("family") : t("senior");
}
function phoneToAuthEmail(phone) {
  return String(phone).replace(/\D/g, "") + "@eldercare.app";
}
function validPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}
function authError(error) {
  const code = error?.code;
  if (code === "auth/configuration-not-found" || code === "auth/operation-not-allowed") return t("auth_not_enabled") + " [" + code + "]";
  if (code === "auth/api-key-not-valid.-please-pass-a-valid-api-key." || code === "auth/invalid-api-key" || code === "auth/app-not-authorized" || code === "auth/unauthorized-domain") return code;
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-email") return t("incorrect_credentials");
  if (code === "auth/email-already-in-use") return t("account_exists");
  if (code === "auth/weak-password") return t("weak_password");
  if (code === "auth/network-request-failed") return t("network_error");
  if (code === "auth/too-many-requests") return t("too_many_attempts");
  return error?.message || t("auth_failed");
}
let loginErrorSpec = null;
function refreshLoginError() {
  if (loginErrorSpec) showLoginError(t(loginErrorSpec.key, { role: roleLabel(loginErrorSpec.role) }), loginErrorSpec);
}
function showLoginError(message, spec) {
  loginErrorSpec = message ? spec || null : null;
  const msg = message ? String(message) : "";
  document.querySelectorAll("[data-auth-error]").forEach(el => {
    const panel = el.closest(".auth-panel");
    // Only update the error box in the visible panel
    if (panel && panel.classList.contains("hidden")) {
      el.textContent = "";
      el.classList.add("hidden");
      el.style.display = "none";
      return;
    }
    el.textContent = msg;
    if (msg) {
      el.classList.remove("hidden");
      el.style.display = "block";
      el.style.visibility = "visible";
      el.setAttribute("role", "alert");
    } else {
      el.classList.add("hidden");
      el.style.display = "none";
    }
  });
}
function clearLoginState() {
  document.querySelectorAll("#login-screen input").forEach(input => {
    if (input.type !== "hidden") input.value = "";
  });
  showLoginError("");
}
function bindPhoneInputs() {
  document.querySelectorAll("input[data-phone-input]").forEach(input => input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 10);
  }));
}
function selectRole(role, button) {
  const btn = button || document.querySelector('[data-role="' + role + '"]');
  document.querySelectorAll("[data-role]").forEach(el => el.classList.toggle("active", el === btn));
  document.body.dataset.selectedRole = role;
  document.querySelectorAll("[data-auth-error]").forEach(el => {
    if (el.closest(".auth-panel")?.classList.contains("hidden")) {
      el.textContent = "";
      el.classList.add("hidden");
    }
  });
}
window.selectRole = selectRole;
function showLogin() {
  location.hash = "#/login";
  currentUser = null;
  currentRole = null;
  session.user = null;
  session.role = null;
  const login = document.getElementById("login-screen");
  const app = document.getElementById("app");
  if (login) { login.classList.remove("hidden"); login.style.display = ""; }
  if (app) { app.classList.add("hidden"); app.style.display = "none"; }
  document.body.dataset.selectedRole = "senior";
  const senior = document.querySelector('[data-role="senior"]');
  if (senior) selectRole("senior", senior);
  applyTranslations?.();
  // Always clear — never leave previous phone/password filled
  const phoneEl = document.getElementById("login-phone");
  const passEl = document.getElementById("login-password");
  if (phoneEl) phoneEl.value = "";
  if (passEl) passEl.value = "";
  showLoginError("");
  showPanel?.("login-panel");
}
function showPanel(panel) {
  document.querySelectorAll(".auth-panel").forEach(el => {
    const show = el.id === panel;
    el.classList.toggle("hidden", !show);
    el.style.display = show ? "" : "none";
  });
  document.querySelectorAll("[data-auth-error]").forEach(el => {
    el.textContent = "";
    el.classList.add("hidden");
    el.style.display = "none";
  });
}
function cachedSession(uid) {
  try {
    const saved = JSON.parse(sessionStorage.getItem("eldercareSession") || "null");
    return saved && saved.uid === uid ? saved : null;
  } catch (error) {
    return null;
  }
}
function normalizeLinkedSeniors(user) {
  const ids = Array.isArray(user.linkedSeniorIds) ? user.linkedSeniorIds.slice() : [];
  let seniors = Array.isArray(user.linkedSeniors) ? user.linkedSeniors.slice() : [];
  // If linkedSeniors is actually an array of UID strings, convert to objects
  seniors = seniors.map(s => {
    if (s && typeof s === "object") {
      return {
        uid: s.uid || s.id || "",
        phone: String(s.phone || "").replace(/\D/g, ""),
        name: s.name || "Senior"
      };
    }
    const id = String(s || "");
    // local-9000000001 style
    if (id.startsWith("local-")) {
      const phone = id.replace(/^local-/, "");
      const local = typeof getLocalUser === "function" ? getLocalUser(phone) : null;
      return { uid: id, phone: phone, name: (local && local.name) || "Senior" };
    }
    // Firebase UID — try local users / leave placeholder to resolve later
    return { uid: id, phone: "", name: "" };
  }).filter(s => s.uid || s.phone);

  // Ensure every linkedSeniorId has an entry
  ids.forEach(id => {
    const sid = String(id || "");
    if (!sid) return;
    if (seniors.some(s => s.uid === sid || (sid.startsWith("local-") && s.phone === sid.replace(/^local-/, "")))) return;
    if (sid.startsWith("local-")) {
      const phone = sid.replace(/^local-/, "");
      const local = typeof getLocalUser === "function" ? getLocalUser(phone) : null;
      seniors.push({ uid: sid, phone, name: (local && local.name) || "Senior" });
    } else {
      seniors.push({ uid: sid, phone: "", name: "" });
    }
  });

  // Fill name/phone from local store when possible
  seniors = seniors.map(s => {
    if (s.phone && s.name && s.name !== "Senior") return s;
    if (s.phone) {
      const local = typeof getLocalUser === "function" ? getLocalUser(s.phone) : null;
      if (local) return { ...s, name: local.name || s.name || "Senior", phone: s.phone || local.phone };
    }
    if (s.uid && s.uid.startsWith("local-")) {
      const phone = s.uid.replace(/^local-/, "");
      const local = typeof getLocalUser === "function" ? getLocalUser(phone) : null;
      if (local) return { uid: s.uid, phone: phone, name: local.name || "Senior" };
    }
    return s;
  });

  user.linkedSeniorIds = ids.length ? ids : seniors.map(s => s.uid).filter(Boolean);
  user.linkedSeniors = seniors;
  // Convenience phone for forms
  if (!user.linkedSeniorPhone && seniors[0] && seniors[0].phone) {
    user.linkedSeniorPhone = seniors[0].phone;
  }
  return user;
}

async function resolveLinkedSeniorNames(user) {
  if (!user || !db) return user;
  const list = Array.isArray(user.linkedSeniors) ? user.linkedSeniors : [];
  const need = list.filter(s => s && s.uid && !String(s.uid).startsWith("local-") && (!s.name || !s.phone));
  if (!need.length) return user;
  try {
    await Promise.all(need.map(async s => {
      try {
        const snap = await db.collection("users").doc(s.uid).get();
        if (snap.exists) {
          const d = snap.data() || {};
          s.name = d.name || s.name || "Senior";
          s.phone = String(d.phone || s.phone || "").replace(/\D/g, "");
        }
      } catch (e) {}
    }));
    user.linkedSeniors = list;
    if (!user.linkedSeniorPhone && list[0] && list[0].phone) user.linkedSeniorPhone = list[0].phone;
  } catch (e) {}
  return user;
}

async function loadUserDocument(firebaseUser) {
  let snap;
  try {
    snap = await db.collection("users").doc(firebaseUser.uid).get();
  } catch (error) {
    // Offline: open the app shell with the last saved profile instead of signing the user out.
    const offline = error?.code === "unavailable" || !navigator.onLine;
    const saved = offline ? cachedSession(firebaseUser.uid) : null;
    if (saved) return normalizeLinkedSeniors({ ...saved });
    throw error;
  }
  if (!snap.exists) throw Error(t("profile_missing"));
  let user = { uid: firebaseUser.uid, ...snap.data() };
  if (user.role === "caregiver" && !user.helperId) {
    const local = getLocalUser(user.phone);
    user.helperId = (local && local.helperId) || ecHelperIdForPhone(user.phone) || undefined;
    if (!user.helperId) delete user.helperId;
  }
  // Keep real linkedSeniors objects; never replace with raw UID list
  user = normalizeLinkedSeniors(user);
  try { user = await resolveLinkedSeniorNames(user); } catch (e) {}
  sessionStorage.setItem("eldercareSession", JSON.stringify(user));
  return user;
}
// First sign-in on a new device (no saved choice): use the language saved on the account.
// Otherwise keep this device's choice and save it to the account.
async function syncLanguage(user) {
  const chosen = localStorage.getItem("language");
  if (chosen === "hi" || chosen === "en") {
    if (chosen !== activeLanguage) await setLanguage(chosen);
    return;
  }
  if (!db || !user?.uid) return;
  const saved = user.language === "hi" || user.language === "en" ? user.language : null;
  if (saved && saved !== activeLanguage) await setLanguage(saved);
  else if (user.language !== activeLanguage) {
    db.collection("users").doc(user.uid).set({ language: activeLanguage }, { merge: true }).catch(() => {});
  }
}
let languageUnsub = null;
function watchLanguage(uid) {
  // Language is owned by this device's Settings / switcher only.
  languageUnsub?.();
  languageUnsub = null;
}
let loginBusy = false;
async function doLogin() {
  if (loginBusy) return;
  const submitBtn = document.querySelector("#login-form button[type=submit], .login-submit");
  const setBusy = (on) => {
    loginBusy = !!on;
    if (submitBtn) {
      submitBtn.disabled = !!on;
      submitBtn.textContent = on
        ? ((typeof t === "function" ? t("signing_in") : null) || "Signing in…")
        : ((typeof t === "function" ? t("sign_in") : null) || "Sign In");
    }
  };
  try {
    setBusy(true);
    try { ensureDemoUsers(); } catch (e) {}

    const role = document.body.dataset.selectedRole || "senior";
    const phone = String((document.getElementById("login-phone") || {}).value || "").replace(/\D/g, "").trim();
    const password = String((document.getElementById("login-password") || {}).value || "").trim();

    if (!validPhone(phone)) {
      showLoginError((typeof t === "function" ? t("invalid_phone") : null) || "Enter a valid 10-digit mobile number starting with 6–9");
      return;
    }
    if (!password) {
      showLoginError((typeof t === "function" ? t("password_required") : null) || "Password is required");
      return;
    }
    showLoginError("");

    // Refresh local map and match password (trim-safe)
    const local = getLocalUser(phone);
    if (local && local.passwordHash === hashPass(password)) {
      if ((local.role || "senior") !== role) {
        const btn = document.querySelector('[data-role="' + local.role + '"]');
        if (btn) selectRole(local.role, btn);
        showLoginError(
          ((typeof t === "function" ? t("wrong_role") : null) || "This number is registered as {role}. Select {role}, then Sign In.")
            .replace(/\{role\}/g, roleLabel(local.role))
        );
        return;
      }
      startLocalSession(local);
      ensureCloudAccount(local, password).then(() => window.ecRestartCloud && window.ecRestartCloud()).catch(() => {});
      return;
    }

    // Firebase fallback (timeout 8s)
    if (typeof auth !== "undefined" && auth) {
      try {
        const credPromise = auth.signInWithEmailAndPassword(phoneToAuthEmail(phone), password);
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej({ code: "auth/timeout" }), 8000));
        const credential = await Promise.race([credPromise, timeoutPromise]);
        let user;
        try {
          user = await loadUserDocument(credential.user);
        } catch (e) {
          // Profile missing — still allow login with selected role
          user = {
            uid: credential.user.uid,
            phone,
            name: phone,
            role: role,
            linkedSeniorIds: [],
            linkedSeniors: []
          };
        }
        const realRole = user.role || role;
        if (realRole !== role) {
          try { await auth.signOut(); } catch (e) {}
          const btn = document.querySelector('[data-role="' + realRole + '"]');
          if (btn) selectRole(realRole, btn);
          showLoginError(
            ((typeof t === "function" ? t("wrong_role") : null) || "This number is registered as {role}. Select {role}, then Sign In.")
              .replace(/\{role\}/g, roleLabel(realRole))
          );
          return;
        }
        // Mirror local so next login works offline
        try {
          const mirror = makeLocalUser({ phone, name: user.name || "", role: realRole, password });
          mirror.uid = user.uid || mirror.uid;
          if (user.linkedSeniorIds) mirror.linkedSeniorIds = user.linkedSeniorIds;
          if (user.linkedSeniors) mirror.linkedSeniors = user.linkedSeniors;
          putLocalUser(mirror);
        } catch (e) {}
        user.role = realRole;
        currentUser = user;
        currentRole = realRole;
        session.user = user;
        session.role = realRole;
        window.__eldercareLoggedOut = false;
        try { sessionStorage.setItem("eldercareSession", JSON.stringify(user)); } catch (e) {}
        bootApp();
        return;
      } catch (error) {
        const code = (error && error.code) || "";
        console.warn("Firebase login failed:", code || error);
        if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
          showLoginError((typeof t === "function" ? t("incorrect_credentials") : null) || "Incorrect password. Try again.");
          return;
        }
      }
    }

    if (local) {
      showLoginError((typeof t === "function" ? t("incorrect_credentials") : null) || "Incorrect password. Try again.");
      return;
    }
    showLoginError(
      (typeof t === "function" ? t("no_account_found") : null)
      || "No account found for this number. Please Create Account first."
    );
  } catch (err) {
    console.error("doLogin error", err);
    showLoginError(String((err && err.message) || err) || "Sign in failed");
  } finally {
    setBusy(false);
  }
}
window.doLogin = doLogin;

function bootApp() {
  currentRole = currentRole || session.role;
  currentUser = currentUser || session.user;
  if (!currentUser) {
    console.warn("bootApp: no user");
    return;
  }
  if (currentRole === "caregiver" && !currentUser.helperId) {
    const hid = ecHelperIdForPhone(currentUser.phone);
    if (hid) { currentUser.helperId = hid; if (session.user) session.user.helperId = hid; }
  }
  try { document.body.dataset.selectedRole = currentRole || currentUser.role || "senior"; } catch (e) {}
  // Always show UI even if translations lag
  document.documentElement.classList.remove("i18n-pending");
  const login = document.getElementById("login-screen");
  const app = document.getElementById("app");
  if (login) login.classList.add("hidden");
  if (app) {
    app.classList.remove("hidden");
    app.style.display = "block";
    app.style.visibility = "visible";
  }
  if (login) {
    login.classList.add("hidden");
    login.style.display = "none";
  }
  document.body.dataset.role = currentRole;
  document.querySelectorAll("[data-current-user-phone]").forEach(el => el.textContent = maskPhone(currentUser.phone));
  document.querySelectorAll("[data-current-user-avatar]").forEach(el => el.textContent = initials(currentUser.name || currentUser.phone));
  document.querySelectorAll("[data-current-role]").forEach(el => el.textContent = roleLabel(currentRole));
  const defaults = (typeof roleDefaults !== "undefined" && roleDefaults) || { senior: "home", caregiver: "home", family: "family" };
  const route = (location.hash || "").replace(/^#\/?/, "");
  if (!route || route === "login" || (currentRole === "family" && route === "home")) {
    location.hash = "#/" + (defaults[currentRole] || "home");
  }
  try {
    if (typeof render === "function") render();
    else console.error("render() missing");
  } catch (err) {
    console.error("render failed", err);
    if (app) app.innerHTML = "<div class='container' style='padding:24px'><h1>Welcome, " +
      (currentUser.name || "User") + "</h1><p>App loaded. If this stays blank, refresh the page.</p></div>";
  }
  try {
    if (typeof reloadMedicinesForSession === "function") reloadMedicinesForSession();
    else if (typeof loadMedicines === "function") {
      const list = loadMedicines();
      window.medicines = list;
      try { if (typeof medicines !== "undefined") medicines = list; } catch (e) {}
    } else {
      window.medicines = [];
    }
  } catch (e) { window.medicines = []; }
  try { applyTranslations?.(); } catch (e) {}
  try { if (typeof registerPushToken === "function" && typeof Notification !== "undefined" && Notification.permission === "granted") registerPushToken(); } catch (e) {}
  try { if (typeof askLocationOnceAfterLogin === "function") askLocationOnceAfterLogin(); } catch (e) {}
  try { ecSyncLinksFromCloud().catch(() => {}); } catch (e) {}
}
function validateSignup(data) {
  if (!data.name) return t("name_required") || "Name is required";
  if (!validPhone(data.phone)) return t("invalid_phone") || "Enter a valid 10-digit Indian mobile (starts with 6-9)";
  if (!data.password || data.password.length < 6) return t("password_min") || "Password must be at least 6 characters";
  if (data.password !== data.confirmPassword) return t("password_mismatch") || "Passwords do not match";
  if (!data.role) return t("signup_invalid") || "Choose a role";
  return "";
}
let signingUp = false;
async function signup() {
  const form = document.getElementById("signup-form");
  if (!form) {
    showLoginError("Signup form not found");
    return;
  }
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  const phone = String(fd.get("phone") || "").replace(/\D/g, "");
  // Read password directly from inputs (most reliable)
  const passEl = form.querySelector('input[name="password"]');
  const confirmEl = form.querySelector('input[name="confirmPassword"]');
  const password = String(passEl ? passEl.value : (fd.get("password") || ""));
  const confirmPassword = String(confirmEl ? confirmEl.value : (fd.get("confirmPassword") || ""));
  let role = document.querySelector(".signup-role.active")?.dataset.signupRole
    || document.getElementById("signup-role")?.value
    || "senior";
  if (role === "helper") role = "caregiver";
  if (!["senior", "family", "caregiver"].includes(role)) role = "senior";

  const data = { name, phone, password, confirmPassword, role };
  const invalid = validateSignup(data);
  if (invalid) {
    showLoginError(invalid);
    return;
  }
  showLoginError("");

  // ---- 1) Always create / update LOCAL account first (guarantees next sign-in works) ----
  const existing = getLocalUser(phone);
  if (existing) {
    // Update password + role if re-registering same number on this device
    existing.passwordHash = hashPass(password);
    existing.name = name || existing.name;
    existing.role = role;
    putLocalUser(existing);
  } else {
    const localUser = makeLocalUser({ name, phone, password, role });
    putLocalUser(localUser);
  }

  // Verify save
  const saved = getLocalUser(phone);
  if (!saved || saved.passwordHash !== hashPass(password)) {
    showLoginError("Could not save account on this phone. Please try again.");
    return;
  }

  // Clear signup fields (so phone is not left filled)
  try {
    form.reset();
    const roleInput = document.getElementById("signup-role");
    if (roleInput) roleInput.value = "senior";
    document.querySelectorAll(".signup-role").forEach((b, i) => b.classList.toggle("active", i === 0));
  } catch (e) {}

  // Clear login fields too (no pre-filled number)
  try {
    const lp = document.getElementById("login-phone");
    const lw = document.getElementById("login-password");
    if (lp) lp.value = "";
    if (lw) lw.value = "";
  } catch (e) {}

  // Set role chip for this session
  document.body.dataset.selectedRole = role;
  const roleBtn = document.querySelector('[data-role="' + role + '"]');
  if (roleBtn) selectRole(role, roleBtn);

  // Sign in immediately from local
  window.__eldercareLoggedOut = false;
  startLocalSession(saved);
  toast((typeof t === "function" ? t("account_created") : null) || "Account created — you are signed in");

  // ---- 2) Optional Firebase sync (does not block local account) ----
  if (auth && db) {
    window.signingUp = true;
    try {
      let uid = null;
      try {
        const cred = await auth.createUserWithEmailAndPassword(phoneToAuthEmail(phone), password);
        uid = cred.user.uid;
      } catch (err) {
        if (err && err.code === "auth/email-already-in-use") {
          try {
            const cred = await auth.signInWithEmailAndPassword(phoneToAuthEmail(phone), password);
            uid = cred.user.uid;
          } catch (e2) {
            console.warn("Firebase already exists, local account is active", e2);
          }
        } else {
          console.warn("Firebase signup skipped:", err && err.code || err);
        }
      }
      if (uid) {
        const profile = {
          uid,
          phone,
          name,
          role,
          linkedSeniorIds: saved.linkedSeniorIds || [],
          linkedSeniors: saved.linkedSeniors || [],
          emergencyContacts: saved.emergencyContacts || [],
          language: localStorage.getItem("language") || "en"
        };
        if (role === "caregiver") { const hid = ecHelperIdForPhone(phone); if (hid) profile.helperId = hid; }
        try {
          await db.collection("users").doc(uid).set(profile, { merge: true });
          await db.collection("phones").doc(phone).set({ uid, role }, { merge: true });
        } catch (e) { console.warn("Firestore profile write", e); }
        // Keep local uid in sync with cloud
        const again = getLocalUser(phone);
        if (again) {
          again.uid = uid;
          putLocalUser(again);
          if (session.user) {
            session.user.uid = uid;
            try { sessionStorage.setItem("eldercareSession", JSON.stringify(session.user)); } catch (e) {}
          }
        }
      }
    } finally {
      window.signingUp = false;
    }
    try { window.ecRestartCloud && window.ecRestartCloud(); } catch (e) {}
  }
}

function showResetHelp() {
  showPanel("reset-panel");
}
async function changePassword() {
  const form = $("#change-password-form");
  const data = Object.fromEntries(new FormData(form));
  if (!data.currentPassword || data.newPassword.length < 6 || data.newPassword !== data.confirmPassword) {
    toast(t("password_change_invalid"), true);
    return;
  }
  try {
    const credential = firebase.auth.EmailAuthProvider.credential(phoneToAuthEmail(currentUser.phone), data.currentPassword);
    await auth.currentUser.reauthenticateWithCredential(credential);
    await auth.currentUser.updatePassword(data.newPassword);
    form.reset();
    toast(t("password_changed"));
  } catch (error) {
    toast(error.code === "auth/wrong-password" ? t("current_password_wrong") : authError(error), true);
  }
}
async function linkSeniorByPhone(phone) {
  const digits = ecDigits(phone);
  // A family member can be linked to only ONE senior
  if (session.user && session.role === "family") {
    try { await resolveLinkedSeniorNames(session.user); } catch (e) {}   // fill in phone numbers for seniors stored only by id
    const linkedPhones = new Set();
    let unknownLinked = false;
    (session.user.linkedSeniors || []).forEach(s => {
      if (!s) return;
      const p = ecDigits(typeof s === "object" ? s.phone : (String(s).startsWith("local-") ? String(s).slice(6) : s));
      if (p.length >= 10) linkedPhones.add(p); else if (typeof s === "object" ? (s.uid || s.name) : s) unknownLinked = true;
    });
    (session.user.linkedSeniorIds || []).forEach(id => {
      const v = String(id || "");
      if (v.startsWith("local-")) linkedPhones.add(ecDigits(v));
      else if (v && !(session.user.linkedSeniors || []).some(s => s && typeof s === "object" && s.uid === v && ecDigits(s.phone))) unknownLinked = true;
    });
    if (session.user.linkedSeniorPhone) linkedPhones.add(ecDigits(session.user.linkedSeniorPhone));
    try { const lu = getLocalUser(session.user.phone); if (lu) (lu.linkedSeniors || []).forEach(s => { const p = ecDigits(s && s.phone); if (p) linkedPhones.add(p); }); } catch (e) {}
    try {   // also check links made from another phone
      if (db) {
        const snap = await db.collection("seniorLinks").where("memberPhones", "array-contains", ecDigits(session.user.phone)).get();
        snap.forEach(d => { const p = ecDigits((d.data() || {}).seniorPhone || d.id); if (p) linkedPhones.add(p); });
      }
    } catch (e) {}
    linkedPhones.delete(digits);   // re-linking the same senior is fine
    if (linkedPhones.size || (unknownLinked && !linkedPhones.has(digits))) {
      const hi = typeof activeLanguage !== "undefined" && activeLanguage === "hi";
      throw Error(hi ? "आप पहले से एक वरिष्ठ से जुड़े हैं। एक परिवार सदस्य केवल एक वरिष्ठ से जुड़ सकता है।" : "You are already linked to a senior. A family member can link to only one senior.");
    }
  }
  const seniorId = await linkSeniorByPhoneCore(phone);
  try {
    const entry = (session.user.linkedSeniors || []).find(s => s && ecDigits(s.phone) === digits);
    await ecSaveLinkToCloud(digits, entry && entry.name);
  } catch (e) { console.warn("save link to cloud", e && e.code); }
  try { window.ecRestartCloud && window.ecRestartCloud(); } catch (e) {}
  return seniorId;
}
async function linkSeniorByPhoneCore(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!validPhone(digits)) throw Error(t("invalid_phone"));
  if (!session.user) throw Error(t("auth_failed") || "Not signed in");
  const myPhone = String(session.user.phone || "").replace(/\D/g, "");
  if (digits === myPhone) throw Error(t("cannot_link_self") || "Cannot link your own number");

  // --- Local / offline link (works without Firebase) ---
  const seniorLocal = getLocalUser(digits);
  if (seniorLocal && (seniorLocal.role || "") !== "senior") {
    throw Error(t("no_senior_found") || "No senior found with this phone number");
  }
  let seniorId = seniorLocal ? (seniorLocal.uid || ("local-" + digits)) : null;
  let seniorName = seniorLocal ? (seniorLocal.name || "") : "";
  let linkedViaLocal = false;

  if (seniorLocal) {
    const famLocal = getLocalUser(myPhone) || null;
    const linkEntry = { phone: digits, name: seniorName || seniorLocal.name || "Senior" };
    const ids = [...new Set([...(session.user.linkedSeniorIds || []), seniorId])];
    const seniors = [...(session.user.linkedSeniors || []).filter(s => String(s.phone || "").replace(/\D/g, "") !== digits), linkEntry];
    session.user.linkedSeniorIds = ids;
    session.user.linkedSeniors = seniors;
    session.user.linkedSeniorPhone = digits;
    if (famLocal) {
      famLocal.linkedSeniorIds = ids;
      famLocal.linkedSeniors = seniors;
      famLocal.linkedSeniorPhone = digits;
      putLocalUser(famLocal);
    }
    // Add family/helper to senior emergency contacts + reverse link
    const rel = session.role === "caregiver" || session.role === "helper" ? "Helper" : "Family";
    const contacts = Array.isArray(seniorLocal.emergencyContacts) ? seniorLocal.emergencyContacts.slice() : [];
    if (myPhone && !contacts.some(c => String(c.phone || "").replace(/\D/g, "") === myPhone)) {
      contacts.push({ name: session.user.name || "", phone: myPhone, relationship: rel });
      seniorLocal.emergencyContacts = contacts;
    }
    if (rel === "Family") {
      seniorLocal.family = [...new Set([...(seniorLocal.family || []), session.user.uid || ("local-" + myPhone)])];
    } else {
      seniorLocal.caregivers = [...new Set([...(seniorLocal.caregivers || []), session.user.uid || ("local-" + myPhone)])];
    }
    putLocalUser(seniorLocal);
    sessionStorage.setItem("eldercareSession", JSON.stringify(session.user));
    linkedViaLocal = true;
  }

  // --- Cloud link when Firebase is available ---
  if (db) {
    try {
      const snap = await db.collection("phones").doc(digits).get();
      if (snap.exists && snap.data().role === "senior") {
        seniorId = snap.data().uid || seniorId;
        try {   // get the senior's real name so it can be shown after linking
          const us = await db.collection("users").doc(seniorId).get();
          if (us.exists && us.data().name) seniorName = us.data().name;
        } catch (e) {}
        const field = (session.role === "caregiver" || session.role === "helper") ? "caregivers" : "family";
        const myCloudUid = (auth && auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.uid) || (!String(session.user.uid || "").startsWith("local-") && session.user.uid) || "";
        if (myCloudUid) {
          await db.collection("users").doc(myCloudUid).set({
            linkedSeniorIds: firebase.firestore.FieldValue.arrayUnion(seniorId),
            linkedSeniors: firebase.firestore.FieldValue.arrayUnion({ uid: seniorId, phone: digits, name: seniorName || "Senior" }),
            linkedSeniorPhone: digits
          }, { merge: true }).catch(e => console.warn("family link write", e && e.code));
        }
        if (seniorId && !String(seniorId).startsWith("local-")) {
          await db.collection("users").doc(seniorId).update({
            [field]: firebase.firestore.FieldValue.arrayUnion(myCloudUid || session.user.uid)
          });
          try {
            if (myPhone) {
              await db.collection("users").doc(seniorId).update({
                emergencyContacts: firebase.firestore.FieldValue.arrayUnion({
                  name: session.user.name || "",
                  phone: myPhone,
                  relationship: field === "caregivers" ? "Helper" : "Family"
                })
              });
            }
          } catch (e) { console.warn("could not add emergency contact", e); }
        }
        if (seniorId) {
          session.user.linkedSeniorIds = [...new Set([...(session.user.linkedSeniorIds || []), seniorId])];
          const entry = { uid: seniorId, phone: digits, name: seniorName || "Senior" };
          const list = (session.user.linkedSeniors || []).filter(s => {
            if (typeof s === "string") return s !== seniorId && s !== digits;
            return String(s.phone || "").replace(/\D/g, "") !== digits;
          });
          list.push(entry);
          session.user.linkedSeniors = list;
          session.user.linkedSeniorPhone = digits;
          sessionStorage.setItem("eldercareSession", JSON.stringify(session.user));
        }
        return seniorId;
      }
      if (!linkedViaLocal) throw Error(t("no_senior_found") || "No senior found with this phone number");
    } catch (e) {
      if (linkedViaLocal) return seniorId;
      if (e && e.message && (e.message.indexOf("senior") >= 0 || e.message === t("no_senior_found"))) throw e;
      if (!linkedViaLocal) throw Error(t("no_senior_found") || "No senior found with this phone number");
    }
  }

  if (linkedViaLocal) return seniorId;
  throw Error(t("no_senior_found") || "No senior found with this phone number");
}
async function doLogout() {
  window.__eldercareLoggedOut = true; // prevent auto re-login
  languageUnsub?.();
  languageUnsub = null;
  try { if (auth) await auth.signOut(); } catch (e) {}
  currentUser = null;
  currentRole = null;
  session.user = null;
  session.role = null;
  session.senior = null;
  sessionStorage.removeItem("eldercareSession");
  // Stop SOS noise
  try {
    localStorage.removeItem("activeSOS");
    localStorage.setItem("pendingSOSAlerts", "[]");
  } catch (e) {}
  document.querySelector(".floating-sos")?.remove();
  document.querySelectorAll(".sos-slot-fixed, #sos-slot .alert-banner, .modal-backdrop.sos-modal").forEach(el => el.remove());
  if (typeof clearTimeout === "function" && typeof sosCascadeTimer !== "undefined") clearTimeout(sosCascadeTimer);
  if (typeof activeSOS !== "undefined") activeSOS = null;
  location.hash = "#/login";
  showLogin();
  // Ensure login form is visible and empty password
  showPanel?.("login-panel");
  const pw = document.getElementById("login-password");
  if (pw) pw.value = "";
  toast(t("sign_in") ? "Signed out" : "Signed out");
}
function logout() {
  return doLogout();
}
function restoreSession() {
  // Remove legacy cross-tab session so old logins do not leak into new tabs
  try { localStorage.removeItem("eldercareSession"); } catch (e) {}
  try { ensureDemoUsers(); } catch (e) {}

  // User explicitly logged out this tab session — stay on login
  if (window.__eldercareLoggedOut) {
    showLogin();
    if (auth) {
      try { auth.onAuthStateChanged(() => {}); } catch (e) {}
    }
    return;
  }
  // Restore offline session first — boot immediately so UI is not stuck on login
  let restoredLocal = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem("eldercareSession") || "null");
    if (saved && saved.phone && saved.role) {
      const local = getLocalUser(saved.phone);
      const user = local ? { ...local } : { ...saved };
      delete user.passwordHash;
      currentUser = user;
      currentRole = user.role || saved.role;
      session.user = user;
      session.role = user.role || saved.role;
      restoredLocal = true;
      bootApp();
    }
  } catch (e) { console.warn("restore local session", e); }

  if (auth) {
    auth.onAuthStateChanged(async firebaseUser => {
      if (window.signingUp || window.__ecBgAuth) return;
      if (window.__eldercareLoggedOut) { showLogin(); return; }
      if (firebaseUser && session.user) {
        // Background cloud sign-in for an already-open session: just reconnect the listeners
        try { window.ecRestartCloud && window.ecRestartCloud(); } catch (e) {}
        return;
      }
      if (!firebaseUser) {
        if (session.user && !window.__eldercareLoggedOut) {
          // Keep local session (demo / offline accounts)
          if (!restoredLocal) bootApp();
          return;
        }
        if (!session.user) showLogin();
        return;
      }
      try {
        const user = await loadUserDocument(firebaseUser);
        currentUser = user;
        currentRole = user.role;
        session.user = user;
        session.role = user.role;
        sessionStorage.setItem("eldercareSession", JSON.stringify(user));
        await syncLanguage?.(user);
        bootApp();
      } catch (error) {
        if (session.user) {
          bootApp();
          return;
        }
        showLoginError(authError(error));
        showLogin();
      }
    });
  } else if (!session.user) {
    showLogin();
  }
}
document.addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.id === "login-password") doLogin();
});

/* Demo accounts for quick testing */
function ensureDemoUsers() {
  const demos = [
    { phone: "9000000001", name: "Ramesh", role: "senior", password: "demo123",
      emergencyContacts: [{ name: "Priya", phone: "9000000002", relationship: "Daughter" }, { name: "Rohan", phone: "9000000004", relationship: "Son" }] },
    { phone: "9000000002", name: "Priya", role: "family", password: "demo123",
      linkedSeniorIds: ["local-9000000001"], linkedSeniors: [{ phone: "9000000001", name: "Ramesh" }] },
    { phone: "9000000004", name: "Rohan", role: "family", password: "demo123",
      linkedSeniorIds: ["local-9000000001"], linkedSeniors: [{ phone: "9000000001", name: "Ramesh" }] },
    { phone: "9000000003", name: "Anil", role: "caregiver", password: "demo123", helperId: "h0",
      linkedSeniorIds: ["local-9000000001"], linkedSeniors: [{ phone: "9000000001", name: "Ramesh" }] },
    { phone: "9000000011", name: "Sunita Devi", role: "caregiver", password: "demo123", helperId: "h1",
      linkedSeniorIds: ["local-9000000001"], linkedSeniors: [{ phone: "9000000001", name: "Ramesh" }] },
    { phone: "9000000012", name: "Ravi Kumar", role: "caregiver", password: "demo123", helperId: "h2",
      linkedSeniorIds: ["local-9000000001"], linkedSeniors: [{ phone: "9000000001", name: "Ramesh" }] },
    { phone: "9000000013", name: "Meena Sharma", role: "caregiver", password: "demo123", helperId: "h3",
      linkedSeniorIds: ["local-9000000001"], linkedSeniors: [{ phone: "9000000001", name: "Ramesh" }] },
    { phone: "9000000014", name: "Imran Ali", role: "caregiver", password: "demo123", helperId: "h4",
      linkedSeniorIds: ["local-9000000001"], linkedSeniors: [{ phone: "9000000001", name: "Ramesh" }] }
  ];
  demos.forEach(d => {
    const existing = getLocalUser(d.phone);
    if (!existing) {
      putLocalUser(makeLocalUser(d));
    } else {
      // Keep demo passwords working even if hash scheme changed
      existing.passwordHash = hashPass(d.password);
      existing.name = d.name || existing.name;
      existing.role = d.role || existing.role;
      if (d.emergencyContacts) existing.emergencyContacts = d.emergencyContacts;
      if (d.linkedSeniorIds) existing.linkedSeniorIds = d.linkedSeniorIds;
      if (d.linkedSeniors) existing.linkedSeniors = d.linkedSeniors;
      if (d.helperId) existing.helperId = d.helperId;
      putLocalUser(existing);
    }
  });
  // default food profile for demo
  if (!localStorage.getItem("eldercareFoodProfile")) {
    localStorage.setItem("eldercareFoodProfile", JSON.stringify({
      conditions: ["diabetes", "bp"],
      diet: "veg",
      region: "North",
      dislikes: "",
      allergies: ""
    }));
  }
}
function fillDemo(role) {
  ensureDemoUsers();
  const map = {
    senior: { phone: "9000000001", role: "senior" },
    family: { phone: "9000000002", role: "family" },
    family2: { phone: "9000000004", role: "family" },
    caregiver: { phone: "9000000003", role: "caregiver" },
    helper: { phone: "9000000011", role: "caregiver" },
    sunita: { phone: "9000000011", role: "caregiver" },
    ravi: { phone: "9000000012", role: "caregiver" },
    meena: { phone: "9000000013", role: "caregiver" },
    imran: { phone: "9000000014", role: "caregiver" }
  };
  const d = map[role] || map.senior;
  document.body.dataset.selectedRole = d.role;
  selectRole(d.role, document.querySelector('[data-role="' + d.role + '"]'));
  const phone = document.getElementById("login-phone");
  const pass = document.getElementById("login-password");
  if (phone) phone.value = d.phone;
  if (pass) pass.value = "demo123";
  showPanel("login-panel");
  if (typeof toast === "function") toast("Demo ready — tap Sign In");
}
window.fillDemo = fillDemo;
window.ensureDemoUsers = ensureDemoUsers;

document.addEventListener("DOMContentLoaded", ensureDemoUsers);
if (document.readyState !== "loading") ensureDemoUsers();
