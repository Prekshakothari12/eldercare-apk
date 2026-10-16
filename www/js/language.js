const localeCache = {};
const originalText = new WeakMap();
const originalAttrs = new WeakMap();
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
let activeLanguage = (localStorage.getItem("language") === "hi") ? "hi" : "en";
let translationObserver = null;
let applyingTranslations = false;
const nativeDialogs = {
  alert: window.alert.bind(window),
  confirm: window.confirm.bind(window),
  prompt: window.prompt.bind(window)
};

function localeTag() {
  return activeLanguage === "hi" ? "hi-IN" : "en-IN";
}

function t(key, values = {}) {
  // Prefer loaded caches; also read inline bundle so offline never shows raw keys
  const inline = (typeof window !== "undefined" && window.__LOCALES) || {};
  const en = localeCache.en || inline.en || {};
  const current = localeCache[activeLanguage] || inline[activeLanguage] || {};
  let text = current[key] || en[key];
  if (text == null || text === "") {
    // Never show the key name on screen — last-resort English-ish label
    text = String(key).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll("{" + name + "}", value), text);
}
// Seed cache from inline locales immediately
if (typeof window !== "undefined" && window.__LOCALES) {
  if (window.__LOCALES.en) localeCache.en = window.__LOCALES.en;
  if (window.__LOCALES.hi) localeCache.hi = window.__LOCALES.hi;
}

function sortedPairs(dict) {
  return Object.entries(dict || {}).filter(([, value]) => value).sort((a, b) => b[1].length - a[1].length);
}

function escRe(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function mapByDictionary(text, fromDict, toDict, warnMissing) {
  let result = text;
  sortedPairs(fromDict).forEach(([key, fromValue]) => {
    if (!fromValue || !result.includes(fromValue)) return;
    const toValue = toDict[key];
    if (toValue) {
      // Whole-word match for plain English words so "of" never rewrites "coffee", "Book" never rewrites "Booking" etc.
      if (/^[A-Za-z0-9 ]+$/.test(fromValue)) {
        result = result.replace(new RegExp("(?<![A-Za-z0-9])" + escRe(fromValue) + "(?![A-Za-z0-9])", "g"), () => toValue);
      } else result = result.replaceAll(fromValue, toValue);
    }
    else if (warnMissing) console.warn("Missing translation key: " + key);
  });
  return result;
}

function toEnglish(text) {
  if (!text) return text;
  return mapByDictionary(text, localeCache.hi, localeCache.en || {}, false);
}

function fromEnglish(text) {
  if (activeLanguage === "en" || !text) return text;
  return mapByDictionary(text, localeCache.en, localeCache.hi || {}, true);
}

function skipNode(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !el || el.closest("script,style,noscript,.language-switcher,[translate=no]");
}

function rememberText(node) {
  if (originalText.has(node)) return originalText.get(node);
  const english = activeLanguage === "en" ? node.nodeValue : toEnglish(node.nodeValue);
  originalText.set(node, english);
  return english;
}

function rememberAttr(el, attr) {
  if (!originalAttrs.has(el)) originalAttrs.set(el, {});
  const store = originalAttrs.get(el);
  if (store[attr] === undefined) {
    const value = el.getAttribute(attr) || "";
    store[attr] = activeLanguage === "en" ? value : toEnglish(value);
  }
  return store[attr];
}

function applyElementKeys(el) {
  if (el.dataset.i18n) el.textContent = t(el.dataset.i18n);
  if (el.dataset.i18nPlaceholder) el.placeholder = t(el.dataset.i18nPlaceholder);
  if (el.dataset.i18nAria) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  if (el.dataset.i18nTitle) el.title = t(el.dataset.i18nTitle);
  if (el.dataset.i18nAlt) el.setAttribute("alt", t(el.dataset.i18nAlt));
}

function translateTree(root) {
  if (!root || skipNode(root)) return;
  if (root.nodeType === 1) {
    applyElementKeys(root);
    ATTRS.forEach(attr => {
      if (!root.hasAttribute(attr)) return;
      if (attr === "placeholder" && root.dataset.i18nPlaceholder) return;
      if (attr === "aria-label" && root.dataset.i18nAria) return;
      if (attr === "title" && root.dataset.i18nTitle) return;
      if (attr === "alt" && root.dataset.i18nAlt) return;
      root.setAttribute(attr, fromEnglish(rememberAttr(root, attr)));
    });
    root.querySelectorAll("*").forEach(el => {
      if (skipNode(el)) return;
      applyElementKeys(el);
      ATTRS.forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        if (attr === "placeholder" && el.dataset.i18nPlaceholder) return;
        if (attr === "aria-label" && el.dataset.i18nAria) return;
        if (attr === "title" && el.dataset.i18nTitle) return;
        if (attr === "alt" && el.dataset.i18nAlt) return;
        el.setAttribute(attr, fromEnglish(rememberAttr(el, attr)));
      });
    });
  }
  const walkerRoot = root.nodeType === 1 ? root : root.parentElement;
  if (!walkerRoot) return;
  const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (skipNode(node) || node.parentElement.closest("[data-i18n]")) continue;
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    node.nodeValue = fromEnglish(rememberText(node));
  }
}

function applyLanguageChrome() {
  document.documentElement.lang = activeLanguage;
  document.documentElement.classList.toggle("hindi", activeLanguage === "hi");
  document.body?.classList.toggle("hindi", activeLanguage === "hi");
  document.querySelectorAll("[data-language-option]").forEach(el => {
    el.classList.toggle("active", el.dataset.languageOption === activeLanguage);
  });
  const switcher = document.querySelector(".language-switcher");
  if (switcher) switcher.setAttribute("aria-label", t("change_language"));
}

function applyTranslations(root) {
  applyingTranslations = true;
  try {
    applyLanguageChrome();
    translateTree(root || document.body);
  } finally {
    applyingTranslations = false;
    document.documentElement.classList.remove("i18n-pending");
  }
}

function observeTranslations() {
  if (translationObserver || !document.body) return;
  translationObserver = new MutationObserver(mutations => {
    if (applyingTranslations) return;
    translationObserver.disconnect();
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1 || node.nodeType === 3) translateTree(node);
      });
      if (mutation.type === "characterData" && mutation.target) translateTree(mutation.target);
    });
    translationObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  });
  translationObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

function wrapDialogs() {
  window.alert = message => nativeDialogs.alert(fromEnglish(String(message ?? "")));
  window.confirm = message => nativeDialogs.confirm(fromEnglish(String(message ?? "")));
  window.prompt = (message, value) => nativeDialogs.prompt(fromEnglish(String(message ?? "")), value);
}

function loadLanguageSwitcher() {
  if (document.querySelector(".language-switcher")) return;
  const switcher = document.createElement("div");
  switcher.className = "language-switcher";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", t("change_language"));
  switcher.innerHTML = '<button type="button" data-language-option="en">EN</button><span aria-hidden="true">|</span><button type="button" data-language-option="hi">हिं</button>';
  switcher.querySelectorAll("[data-language-option]").forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.languageOption));
  });
  document.body.append(switcher);
}

async function loadLocale(lang) {
  if (!localeCache[lang]) {
    // Built-in copy first: always available, even from file:// or with a stale cache. Fetch only refreshes it.
    if (window.__LOCALES?.[lang]) localeCache[lang] = window.__LOCALES[lang];
    try {
      const response = await fetch("locales/" + lang + ".json", { cache: "no-store" });
      if (response.ok) localeCache[lang] = await response.json();
    } catch (error) {
      console.warn("Using built-in " + lang + " translations", error);
    }
    if (!localeCache[lang]) throw Error("Unable to load " + lang + " locale");
  }
  return localeCache[lang];
}

async function setLanguage(lang) {
  try {
    activeLanguage = lang === "hi" ? "hi" : "en";
    localStorage.setItem("language", activeLanguage);
    document.documentElement.lang = activeLanguage;
    const [en] = await Promise.all([loadLocale("en"), loadLocale(activeLanguage)]);
    localeCache.en = en;
    if (typeof db !== "undefined" && db && session?.user?.uid) {
      db.collection("users").doc(session.user.uid).set({ language: activeLanguage }, { merge: true }).catch(error => console.warn("Could not save language preference", error));
    }
    if (typeof refreshLoginError === "function") refreshLoginError();
    if (typeof render === "function" && session?.user) render();
    applyTranslations();
  } catch (error) {
    console.error(error);
    if (typeof toast === "function") toast(t("language_error"), true);
  }
}

async function initLanguage() {
  document.documentElement.lang = activeLanguage;
  wrapDialogs();
  try {
    await Promise.all([loadLocale("en"), loadLocale(activeLanguage)]);
  } catch (error) {
    console.error(error);
  }
  loadLanguageSwitcher();
  applyTranslations();
  observeTranslations();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initLanguage);
else initLanguage();
