/* Government Scheme Navigator: Senior, Family and Caregiver views.
   Add as the LAST script in index.html (after js/caregiver.js).
   Reads data/schemes.json; eligibility rules and English/Hindi text live in this file. */
(function () {
  const KEY = "eldercareSchemeAnswers";

  /* ---------- text (English + Hindi). Merged into the app's own t() dictionary ---------- */
  const STR = {
    en: {
      sn_nav: "Schemes", sn_title: "Government Schemes",
      sn_intro: "Answer 4 quick questions to see which schemes may suit you. You can also browse every scheme below.",
      sn_age: "Age", sn_gender: "Gender", sn_choose: "Choose", sn_female: "Female", sn_male: "Male", sn_other: "Prefer not to say",
      sn_bpl: "Do you have a BPL / ration card?", sn_yes: "Yes", sn_no: "No", sn_notsure: "Not sure",
      sn_pension: "Are you receiving a pension now?", sn_check: "Check eligibility", sn_reset: "Start again",
      sn_search: "Search schemes", sn_all: "All", sn_tile_sub: "Pension and benefits", sn_prompt: "Fill in your details and tap Check eligibility to see the schemes that may suit you.", sn_browse_all: "Browse all schemes", sn_pension_c: "Pension", sn_health_c: "Health", sn_finance_c: "Finance", sn_legal_c: "Legal", sn_travel_c: "Travel",
      sn_likely: "Likely eligible", sn_maybe: "Check eligibility", sn_apply: "Apply on official site", sn_why: "Why:",
      sn_matches: "{n} schemes may suit you", sn_none: "No scheme matched. Try browsing all schemes.", sn_browse: "Showing all {n} schemes",
      sn_nomatch: "{n} schemes did not match your answers", sn_empty: "No schemes found", sn_loading: "Loading schemes...",
      sn_load_fail: "Could not load schemes. Check your internet connection.", sn_age_invalid: "Enter a valid age (1 to 130)",
      sn_disclaimer: "This is only a guide. Please confirm eligibility on the official site before applying.",
      sn_r_age_min: "Age {min} or above", sn_r_age_max: "Only for ages up to {max}", sn_r_age_between: "Only for ages {min} to {max}",
      sn_r_bpl_yes: "You have a BPL / ration card", sn_r_bpl_need: "Needs a BPL / ration card", sn_r_bpl_check: "Needs a BPL / ration card. Please check yours",
      sn_r_open: "Open to everyone", sn_r_age70: "Age 70 or above (any income)", sn_r_age70_or_bpl: "Needs age 70 or above, or a BPL family",
      sn_r_pension_overlap: "May not be paid together with another pension", sn_r_age_55: "Age 55 to 59 only for some retired people",
      sn_r_disability: "Only if you or a family member has a disability", sn_r_farmer: "Only for farmer families",
      sn_n_state: "Rules differ by state.", sn_r_pensioner: "For people who receive a pension"
    },
    hi: {
      sn_nav: "योजनाएँ", sn_title: "सरकारी योजनाएँ",
      sn_intro: "4 आसान सवालों के जवाब दें और देखें कि कौन सी योजनाएँ आपके लिए उपयुक्त हो सकती हैं। आप नीचे सभी योजनाएँ भी देख सकते हैं।",
      sn_age: "आयु", sn_gender: "लिंग", sn_choose: "चुनें", sn_female: "महिला", sn_male: "पुरुष", sn_other: "बताना नहीं चाहते",
      sn_bpl: "क्या आपके पास BPL / राशन कार्ड है?", sn_yes: "हाँ", sn_no: "नहीं", sn_notsure: "पक्का नहीं पता",
      sn_pension: "क्या आपको अभी पेंशन मिल रही है?", sn_check: "पात्रता जाँचें", sn_reset: "फिर से शुरू करें",
      sn_search: "योजनाएँ खोजें", sn_all: "सभी", sn_tile_sub: "पेंशन और लाभ", sn_prompt: "अपनी जानकारी भरें और पात्रता जाँचें दबाएँ, ताकि आपके लिए उपयुक्त योजनाएँ दिखें।", sn_browse_all: "सभी योजनाएँ देखें", sn_pension_c: "पेंशन", sn_health_c: "स्वास्थ्य", sn_finance_c: "वित्त", sn_legal_c: "कानूनी", sn_travel_c: "यात्रा",
      sn_likely: "संभवतः पात्र", sn_maybe: "पात्रता जाँचें", sn_apply: "आधिकारिक साइट पर आवेदन करें", sn_why: "कारण:",
      sn_matches: "{n} योजनाएँ आपके लिए उपयुक्त हो सकती हैं", sn_none: "कोई योजना मेल नहीं खाई। सभी योजनाएँ देखकर देखें।", sn_browse: "सभी {n} योजनाएँ दिख रही हैं",
      sn_nomatch: "{n} योजनाएँ आपके उत्तरों से मेल नहीं खाईं", sn_empty: "कोई योजना नहीं मिली", sn_loading: "योजनाएँ लोड हो रही हैं...",
      sn_load_fail: "योजनाएँ लोड नहीं हो सकीं। अपना इंटरनेट कनेक्शन जाँचें।", sn_age_invalid: "सही आयु दर्ज करें (1 से 130)",
      sn_disclaimer: "यह केवल एक मार्गदर्शिका है। आवेदन से पहले कृपया आधिकारिक साइट पर पात्रता की पुष्टि करें।",
      sn_r_age_min: "आयु {min} वर्ष या अधिक", sn_r_age_max: "केवल {max} वर्ष तक की आयु के लिए", sn_r_age_between: "केवल {min} से {max} वर्ष की आयु के लिए",
      sn_r_bpl_yes: "आपके पास BPL / राशन कार्ड है", sn_r_bpl_need: "BPL / राशन कार्ड ज़रूरी है", sn_r_bpl_check: "BPL / राशन कार्ड ज़रूरी है। कृपया अपना जाँच लें",
      sn_r_open: "सभी के लिए खुली", sn_r_age70: "उम्र 70 साल या ज़्यादा (आमदनी कितनी भी हो)", sn_r_age70_or_bpl: "आयु 70 वर्ष या अधिक, या BPL परिवार होना चाहिए",
      sn_r_pension_overlap: "दूसरी पेंशन के साथ शायद न मिले", sn_r_age_55: "55 से 59 वर्ष की आयु केवल कुछ सेवानिवृत्त लोगों के लिए",
      sn_r_disability: "केवल तभी जब आपको या परिवार के किसी सदस्य को दिव्यांगता हो", sn_r_farmer: "केवल किसान परिवारों के लिए",
      sn_n_state: "नियम राज्य के अनुसार अलग हैं।", sn_r_pensioner: "पेंशन पाने वालों के लिए",
      sn_d_ignoaps: "BPL परिवारों के 60 वर्ष और अधिक आयु के नागरिकों के लिए मासिक पेंशन।",
      sn_d_avv: "70 वर्ष और अधिक आयु के हर नागरिक के लिए, आय चाहे जो हो, प्रति वर्ष ₹5 लाख तक मुफ़्त अस्पताल कवर।",
      sn_d_pmjay: "पात्र कम आय वाले परिवारों के लिए प्रति वर्ष ₹5 लाख तक मुफ़्त अस्पताल कवर।",
      sn_d_scss: "60+ आयु के लिए पोस्ट ऑफिस बचत खाता, हर तिमाही नियमित ब्याज।",
      sn_d_jp: "बैंक गए बिना अपना पेंशन जीवन प्रमाण पत्र डिजिटल रूप से जमा करें।",
      sn_d_nphce: "60+ आयु के लिए सरकारी अस्पतालों में स्वास्थ्य सेवाएँ, जिसमें वृद्धावस्था देखभाल शामिल है।",
      sn_d_rvy: "BPL वरिष्ठों के लिए मुफ़्त छड़ी, श्रवण यंत्र, व्हीलचेयर और अन्य सहायक उपकरण।",
      sn_d_abdm: "अपने स्वास्थ्य रिकॉर्ड डिजिटल रूप से रखने के लिए मुफ़्त ABHA हेल्थ आईडी।",
      sn_d_pmjdy: "रुपे कार्ड और दुर्घटना कवर के साथ ज़ीरो-बैलेंस बैंक खाता।",
      sn_d_pomis: "पोस्ट ऑफिस खाता जो हर महीने तय आय देता है।",
      sn_d_pmsby: "18 से 70 वर्ष की आयु के लिए बहुत कम वार्षिक प्रीमियम पर दुर्घटना बीमा।",
      sn_d_tax: "वरिष्ठ नागरिकों के लिए अधिक कर छूट और विशेष कटौतियाँ।",
      sn_d_elderline: "वरिष्ठों के लिए निःशुल्क हेल्पलाइन 14567: जानकारी, मार्गदर्शन, भावनात्मक सहारा और दुर्व्यवहार में मदद।",
      sn_d_act: "कानून जिससे माता-पिता और वरिष्ठ अपने बच्चों या रिश्तेदारों से भरण-पोषण का दावा कर सकते हैं।"
    }
  };
  function mergeStrings() {
    ["en", "hi"].forEach(l => {
      if (window.__LOCALES && window.__LOCALES[l]) Object.assign(window.__LOCALES[l], STR[l]);
      if (typeof localeCache !== "undefined" && localeCache[l]) Object.assign(localeCache[l], STR[l]);
    });
  }
  mergeStrings();
  if (typeof loadLocale === "function") {
    const originalLoad = loadLocale;
    loadLocale = async function (lang) { const result = await originalLoad(lang); mergeStrings(); return result; };
  }
  const lang = () => (typeof activeLanguage !== "undefined" ? activeLanguage : "en");
  const tx = (key, vals) => (typeof t === "function" ? t(key, vals) : (STR.en[key] || key));
  const hiOnly = (key, fallback) => (lang() === "hi" && STR.hi[key]) || fallback;

  /* ---------- eligibility rules (matched to data/schemes.json by scheme name) ---------- */
  // Each rule returns [status, reasonKey, values, noteKey]; status is "yes", "maybe" or "no".
  function g(a, o) {
    if (o.min != null && a.age < o.min) return ["no", o.max != null ? "sn_r_age_between" : "sn_r_age_min", o];
    if (o.max != null && a.age > o.max) return ["no", o.min != null ? "sn_r_age_between" : "sn_r_age_max", o];
    if (o.bpl === "need") {
      if (a.bpl === "no") return ["no", "sn_r_bpl_need", o];
      if (a.bpl === "unknown") return ["maybe", "sn_r_bpl_check", o, o.note];
    }
    if (o.nopen && a.pension === "yes") return ["maybe", "sn_r_pension_overlap", o, o.note];
    return ["yes", o.bpl === "need" ? "sn_r_bpl_yes" : o.min != null ? "sn_r_age_min" : "sn_r_open", o, o.note];
  }
  const RULES = [
    { id: "ignoaps", m: "IGNOAPS", f: a => g(a, { min: 60, bpl: "need", nopen: true }) },
    { id: "avv", m: "Ayushman Vay Vandana Card", f: a => a.age >= 70 ? ["yes", "sn_r_age70"] : ["no", "sn_r_age_min", { min: 70 }] },
    { id: "pmjay", m: "PM-JAY", f: a => a.bpl === "yes" ? ["yes", "sn_r_bpl_yes"] : a.bpl === "unknown" ? ["maybe", "sn_r_bpl_check"] : ["no", "sn_r_bpl_need"] },
    { id: "scss", m: "Senior Citizens Savings Scheme", f: a => a.age >= 60 ? ["yes", "sn_r_age_min", { min: 60 }] : a.age >= 55 ? ["maybe", "sn_r_age_55"] : ["no", "sn_r_age_min", { min: 60 }] },
    { id: "jp", m: "Jeevan Pramaan", f: a => a.pension === "yes" ? ["yes", "sn_r_pensioner"] : ["maybe", "sn_r_pensioner"] },
    { id: "nphce", m: "National Programme for Health Care of the Elderly", f: a => g(a, { min: 60 }) },
    { id: "rvy", m: "Rashtriya Vayoshri Yojana", f: a => g(a, { min: 60, bpl: "need" }) },
    { id: "abdm", m: "Ayushman Bharat Digital Mission", f: () => ["yes", "sn_r_open"] },
    { id: "pmjdy", m: "Pradhan Mantri Jan Dhan Yojana", f: () => ["yes", "sn_r_open"] },
    { id: "pomis", m: "Post Office Monthly Income Scheme", f: a => g(a, { min: 18 }) },
    { id: "pmsby", m: "Pradhan Mantri Suraksha Bima Yojana", f: a => g(a, { min: 18, max: 70 }) },
    { id: "tax", m: "Income Tax Senior Citizen Benefits", f: a => g(a, { min: 60 }) },
    { id: "elderline", m: "Elderline 14567", f: a => g(a, { min: 60 }) },
    { id: "act", m: "Maintenance and Welfare of Parents and Senior Citizens Act", f: () => ["yes", "sn_r_open"] }
  ];
  const ruleFor = name => RULES.find(r => r.m === name);

  /* ---------- state + data ---------- */
  /* Built-in copy so schemes always show, even if data/schemes.json cannot be fetched */
  const BUILTIN = [
 {
  "name": "Senior Citizens Savings Scheme",
  "description": "Post Office savings account for ages 60+ with regular interest paid every quarter.",
  "category": "Finance",
  "url": "https://www.indiapost.gov.in/"
 },
 {
  "name": "Jeevan Pramaan",
  "description": "Submit your pension life certificate digitally, without visiting the bank.",
  "category": "Pension",
  "url": "https://jeevanpramaan.gov.in/"
 },
 {
  "name": "Ayushman Bharat Digital Mission",
  "description": "Free ABHA health ID to keep your health records digitally.",
  "category": "Health",
  "url": "https://abdm.gov.in/"
 },
 {
  "name": "Pradhan Mantri Jan Dhan Yojana",
  "description": "Zero-balance bank account with RuPay card and accident cover.",
  "category": "Finance",
  "url": "https://pmjdy.gov.in/"
 },
 {
  "name": "Post Office Monthly Income Scheme",
  "description": "Post Office account that pays a fixed monthly income.",
  "category": "Finance",
  "url": "https://www.indiapost.gov.in/"
 },
 {
  "name": "Pradhan Mantri Suraksha Bima Yojana",
  "description": "Accident insurance for ages 18 to 70 at a very low yearly premium.",
  "category": "Health",
  "url": "https://jansuraksha.gov.in/"
 },
 {
  "name": "Income Tax Senior Citizen Benefits",
  "description": "Higher tax exemption and special deductions for senior citizens.",
  "category": "Finance",
  "url": "https://www.incometax.gov.in/"
 },
 {
  "name": "Elderline 14567",
  "description": "Free helpline 14567 for seniors: information, guidance, emotional support and help in case of abuse.",
  "category": "Legal",
  "url": "https://socialjustice.gov.in/"
 }
];
    const state = { list: BUILTIN, failed: false, cat: "all", q: "", checked: false, answers: null, browse: false };
  try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && saved.age) { state.answers = saved; state.checked = true; } } catch (e) {}

  async function loadSchemes() {
    if (state.loaded || state.loading || typeof fetch !== "function") return;
    state.loading = true;
    try {
      const response = await fetch("data/schemes.json", { cache: "no-store" });
      if (!response.ok) throw Error("load");
      const fresh = await response.json();
      if (Array.isArray(fresh) && fresh.length) { state.list = fresh; state.loaded = true; paint(); }
    } catch (e) { /* keep the built-in list */ }
    state.loading = false;
  }

  /* ---------- rendering ---------- */
  const E = s => (typeof esc === "function" ? esc(s) : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]));
  const CATS = [["all", "sn_all"], ["Pension", "sn_pension_c"], ["Health", "sn_health_c"], ["Finance", "sn_finance_c"], ["Legal", "sn_legal_c"]];
  const opt = (value, key, sel) => `<option value="${value}"${sel === value ? " selected" : ""}>${tx(key)}</option>`;

  function formHTML() {
    const a = state.answers || {};
    return `<form id="eligibility-form" class="card stack sn-form">
      <div class="form-field"><label for="sn-age">${tx("sn_age")}</label><input id="sn-age" name="age" type="number" inputmode="numeric" min="1" max="130" required value="${a.age || ""}"></div>
      <div class="form-field"><label for="sn-gender">${tx("sn_gender")}</label><select id="sn-gender" name="gender" required>${opt("", "sn_choose", a.gender || "")}${opt("female", "sn_female", a.gender)}${opt("male", "sn_male", a.gender)}${opt("other", "sn_other", a.gender)}</select></div>
      <div class="form-field"><label for="sn-bpl">${tx("sn_bpl")}</label><select id="sn-bpl" name="bpl" required>${opt("", "sn_choose", a.bpl || "")}${opt("yes", "sn_yes", a.bpl)}${opt("no", "sn_no", a.bpl)}${opt("unknown", "sn_notsure", a.bpl)}</select></div>
      <div class="form-field"><label for="sn-pension">${tx("sn_pension")}</label><select id="sn-pension" name="pension" required>${opt("", "sn_choose", a.pension || "")}${opt("yes", "sn_yes", a.pension)}${opt("no", "sn_no", a.pension)}</select></div>
      <button class="btn btn-primary" type="submit"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> ${tx("sn_check")}</button>
      ${state.checked ? `<button class="btn btn-ghost" type="button" id="sn-reset">${tx("sn_reset")}</button>` : ""}
    </form>`;
  }

  const HI_SCHEME_NAMES = {"IGNOAPS": "इंदिरा गांधी राष्ट्रीय वृद्धावस्था पेंशन योजना (IGNOAPS)", "Ayushman Vay Vandana Card": "आयुष्मान वय वंदना कार्ड", "PM-JAY": "प्रधानमंत्री जन आरोग्य योजना (PM-JAY)", "Senior Citizens Savings Scheme": "वरिष्ठ नागरिक बचत योजना", "Jeevan Pramaan": "जीवन प्रमाण", "National Programme for Health Care of the Elderly": "वृद्धजनों की स्वास्थ्य देखभाल का राष्ट्रीय कार्यक्रम", "Rashtriya Vayoshri Yojana": "राष्ट्रीय वयोश्री योजना", "Ayushman Bharat Digital Mission": "आयुष्मान भारत डिजिटल मिशन", "Pradhan Mantri Jan Dhan Yojana": "प्रधानमंत्री जन धन योजना", "Post Office Monthly Income Scheme": "पोस्ट ऑफिस मासिक आय योजना", "Pradhan Mantri Suraksha Bima Yojana": "प्रधानमंत्री सुरक्षा बीमा योजना", "Income Tax Senior Citizen Benefits": "आयकर वरिष्ठ नागरिक लाभ", "Elderline 14567": "एल्डरलाइन 14567", "Maintenance and Welfare of Parents and Senior Citizens Act": "माता-पिता और वरिष्ठ नागरिकों का भरण-पोषण और कल्याण अधिनियम"};
  function schemeName(n) { try { return (typeof activeLanguage !== "undefined" && activeLanguage === "hi" && HI_SCHEME_NAMES[n]) || n; } catch (e) { return n; } }
  function cardHTML(item) {
    const s = item.scheme, res = item.result;
    const badge = res ? (res[0] === "yes" ? `<span class="badge success">${tx("sn_likely")}</span>` : res[0] === "maybe" ? `<span class="badge warning">${tx("sn_maybe")}</span>` : "") : "";
    const why = res ? `<p class="sn-why"><strong>${tx("sn_why")}</strong> ${tx(res[1], res[2])}${res[3] ? ` <em>${tx(res[3])}</em>` : ""}</p>` : "";
    const desc = hiOnly("sn_d_" + (item.rule ? item.rule.id : ""), s.description);
    return `<article class="card scheme-item sn-card${res && res[0] === "no" ? " sn-dim" : ""}"><div class="row between sn-top"><span class="badge blue">${typeof schemeCategoryLabel === "function" ? schemeCategoryLabel(s.category) : s.category}</span>${badge}</div>
      <h2 translate="no">${E(schemeName(s.name))}</h2><p>${E(desc)}</p>${why}
      <a class="btn btn-secondary" href="${E(s.url)}" target="_blank" rel="noopener" aria-label="${E(tx("sn_apply") + ": " + schemeName(s.name))}">${tx("sn_apply")} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></article>`;
  }

  function resultsHTML() {
    if (state.failed) return `<div class="card empty"><p>${tx("sn_load_fail")}</p></div>`;
    if (!state.list) return `<div class="card empty"><p>${tx("sn_loading")}</p></div>`;
    const items = state.list.map(s => { const rule = ruleFor(s.name); return { scheme: s, rule, result: state.checked && rule ? rule.f(state.answers) : null }; })
      .filter(i => (state.cat === "all" || i.scheme.category === state.cat) && (!state.q || (i.scheme.name + " " + i.scheme.description).toLowerCase().includes(state.q)));
    let html = "", status = "";
    if (!state.checked && !state.browse) {
      return `<p id="scheme-status" class="muted sn-prompt" role="status" aria-live="polite">${tx("sn_prompt")}</p><button type="button" class="btn btn-secondary" id="sn-browse">${tx("sn_browse_all")}</button>`;
    }
    if (state.checked) {
      const rank = { yes: 0, maybe: 1 };
      const match = items.filter(i => !i.result || i.result[0] !== "no").sort((x, y) => (rank[x.result && x.result[0]] ?? 1) - (rank[y.result && y.result[0]] ?? 1));
      const miss = items.filter(i => i.result && i.result[0] === "no");
      status = match.length ? tx("sn_matches", { n: match.length }) : tx("sn_none");
      html = match.map(cardHTML).join("");
      if (miss.length) html += `<details class="sn-miss"><summary>${tx("sn_nomatch", { n: miss.length })}</summary><div class="scheme-grid">${miss.map(cardHTML).join("")}</div></details>`;
    } else {
      status = tx("sn_browse", { n: items.length });
      html = items.map(cardHTML).join("");
    }
    if (!items.length) html = `<div class="card empty"><p>${tx("sn_empty")}</p></div>`;
    return `<p id="scheme-status" class="muted" role="status" aria-live="polite">${status}</p><div class="scheme-grid">${html}</div><p class="muted sn-note">${tx("sn_disclaimer")}</p>`;
  }

  function paint() { const box = document.getElementById("scheme-results"); if (box) { box.innerHTML = resultsHTML(); if (typeof applyTranslations === "function") applyTranslations(box); } }

  function schemesPage(role) {
    loadSchemes();
    return `<div class="schemes-page schemes-${role}"><h1>${tx("sn_title")}</h1><p class="muted">${tx("sn_intro")}</p>${formHTML()}
      <input id="scheme-search" class="form-field sn-search" type="search" placeholder="${E(tx("sn_search"))}" aria-label="${E(tx("sn_search"))}" value="${E(state.q)}">
      <div class="filter-row sn-chips">${CATS.map(([v, k]) => `<button type="button" class="chip${state.cat === v ? " active" : ""}" data-sn-cat="${v}">${tx(k)}</button>`).join("")}</div>
      <div id="scheme-results">${resultsHTML()}</div></div>`;
  }

  /* ---------- events (delegated, so they survive every re-render) ---------- */
  document.addEventListener("submit", e => {
    if (e.target.id !== "eligibility-form") return;
    e.preventDefault();
    const f = new FormData(e.target), age = parseInt(f.get("age"), 10);
    if (!(age >= 1 && age <= 130)) { if (typeof toast === "function") toast(tx("sn_age_invalid"), true); return; }
    state.answers = { age, gender: f.get("gender"), bpl: f.get("bpl"), pension: f.get("pension") };
    state.checked = true;
    state.browse = false;
    try { localStorage.setItem(KEY, JSON.stringify(state.answers)); } catch (err) {}
    if (typeof render === "function") render(); else paint();
    setTimeout(() => document.getElementById("scheme-status")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
  });
  document.addEventListener("click", e => {
    const chip = e.target.closest("[data-sn-cat]");
    if (chip) { state.cat = chip.dataset.snCat; document.querySelectorAll("[data-sn-cat]").forEach(b => b.classList.toggle("active", b === chip)); paint(); return; }
    if (e.target.closest("#sn-browse")) { state.browse = true; paint(); return; }
    if (e.target.closest("#sn-reset")) { state.answers = null; state.checked = false; state.browse = false; try { localStorage.removeItem(KEY); } catch (err) {} if (typeof render === "function") render(); }
  });
  document.addEventListener("input", e => { if (e.target.id === "scheme-search") { state.q = e.target.value.trim().toLowerCase(); paint(); } });

  /* ---------- hook into the three views ---------- */
  const routeOf = () => location.hash.replace("#/", "") || "";

  // Senior: new "Government Schemes" tile on the home screen + a schemes page
  const seniorRender = renderSenior;
  renderSenior = function (root) {
    const route = routeOf() || "home";
    if (route === "schemes") {
      root.className = "app-shell senior-mode";
      root.innerHTML = seniorShell(tx("sn_title"), schemesPage("senior"));
      if (typeof injectSOS === "function") injectSOS();
      return;
    }
    seniorRender(root);
    // Do not inject a second Schemes tile — senior home already has one.
  };

  // Family: schemes tab (reuses the family header and bottom navigation)
  const familyRender = renderFamily;
  renderFamily = function (root) {
    familyRender(root);
    if (routeOf() === "schemes") { const main = root.querySelector("main.container"); if (main) main.innerHTML = schemesPage("family"); }
  };

    // Helper must not open Schemes — redirect home if they hit the route
  const caregiverRenderBase = renderCaregiver;
  renderCaregiver = function (root) {
    if (routeOf() === "schemes") {
      location.hash = "#/home";
      return;
    }
    caregiverRenderBase(root);
  };

  // Bottom navigation: Schemes tab for Senior, Family and Caregiver (just before the last tab)
  ["senior", "family"].forEach(role => {
    if (typeof roleNav !== "undefined" && roleNav[role] && !roleNav[role].some(x => x[0] === "schemes"))
      roleNav[role].splice(roleNav[role].length - 1, 0, ["schemes", "sn_nav", "fa-landmark"]);
  });
  // Helper (caregiver) must never get Schemes tab
  if (typeof roleNav !== "undefined" && roleNav.caregiver) {
    roleNav.caregiver = roleNav.caregiver.filter(x => x[0] !== "schemes");
  }

  // Small styles so no CSS file needs editing
  const style = document.createElement("style");
  style.textContent = `.schemes-page{display:grid;gap:16px;padding-bottom:88px}.sn-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.sn-card{display:grid;gap:8px}.sn-card h2{margin:0}.sn-dim{opacity:.75}.sn-top{gap:8px}.sn-why{font-size:16px;margin:0}.sn-note{font-size:16px}.sn-miss summary{cursor:pointer;font-weight:600;padding:12px 0}
.sn-search{min-height:44px;border:1.5px solid var(--border);border-radius:12px;padding:10px 12px;width:100%}
.schemes-senior .form-field input,.schemes-senior .form-field select,.schemes-senior .sn-search{min-height:60px;font-size:var(--fs-base)}
.schemes-senior .btn{min-height:60px;font-size:var(--fs-btn)}.schemes-senior .chip{padding:12px 18px;font-size:var(--fs-base)}.schemes-senior .sn-why{font-size:var(--fs-base)}
.home-tile.sn-tile{grid-column:1/-1}.sn-prompt{margin:0;font-size:16px}.schemes-senior .sn-prompt{font-size:var(--fs-base)}`;
  document.head.appendChild(style);
})();