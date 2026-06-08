// Slides NoBanana — content script.
//
// Hides the Gemini / Nano Banana "Beautify this slide" button that Google
// Slides renders between the slide canvas and the speaker-notes area. Google's
// class names are obfuscated and change often, so we identify the button by its
// accessible name (aria-label / tooltip / text) rather than by class. A
// MutationObserver keeps it hidden as the single-page app re-renders and as the
// user switches slides.
//
// A "pick mode" lets the user click the button once to capture a stable
// signature for it — useful when the on-screen label differs from our built-in
// list (e.g. a locale we didn't anticipate).

(function () {
  "use strict";

  const NB = self.NOBANANA;
  const HIDDEN_ATTR = "data-nobanana-hidden";
  const HIDDEN_CLASS = "nobanana-hidden";

  let settings = Object.assign({}, NB.DEFAULTS);
  let pickMode = false;

  // Optimistically enable the built-in CSS rules (defaults are enabled) so the
  // well-known "Beautify this slide" button never flashes before storage loads.
  // applySettings() corrects this once the real settings arrive.
  document.documentElement.classList.add("nobanana-builtin");

  // ---- utilities ----------------------------------------------------------

  function normalize(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  // The accessible name we test against. Prefer attributes (clean) over text
  // (which can include icon-font ligatures like "auto_awesome").
  function accessibleName(el) {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("data-tooltip") ||
      el.getAttribute("title") ||
      el.textContent ||
      ""
    );
  }

  function activeLabels() {
    const labels = [];
    if (settings.useBuiltin) {
      for (const l of NB.DEFAULT_LABELS) labels.push(normalize(l));
    }
    for (const c of settings.custom || []) {
      if (c && c.value) labels.push(normalize(c.value));
    }
    return labels;
  }

  function isProtected(name) {
    for (const n of NB.NEVER_LABELS) {
      if (name.includes(normalize(n))) return true;
    }
    return false;
  }

  function shouldHide(el) {
    const name = normalize(accessibleName(el));
    if (!name) return false;
    if (isProtected(name)) return false;
    for (const label of activeLabels()) {
      if (label && name.includes(label)) return true;
    }
    return false;
  }

  function hide(el) {
    if (el.getAttribute(HIDDEN_ATTR) === "1") return;
    el.setAttribute(HIDDEN_ATTR, "1");
    el.classList.add(HIDDEN_CLASS);
  }

  function unhideAll() {
    document
      .querySelectorAll("[" + HIDDEN_ATTR + '="1"]')
      .forEach((el) => {
        el.removeAttribute(HIDDEN_ATTR);
        el.classList.remove(HIDDEN_CLASS);
      });
  }

  // Candidate elements: button-like roles plus anything carrying an accessible
  // label/tooltip (the beautify chip is sometimes a labeled container, not a
  // <button>). We still only hide on a specific label match, so this stays safe
  // and survives re-renders when switching slides.
  const CANDIDATE_SELECTOR =
    '[role="button"], button, [aria-label], [data-tooltip]';

  function scan(root) {
    if (!settings.enabled) return;
    const scope = root && root.querySelectorAll ? root : document;
    let nodes;
    try {
      nodes = scope.querySelectorAll(CANDIDATE_SELECTOR);
    } catch (e) {
      return;
    }
    for (const el of nodes) {
      if (shouldHide(el)) hide(el);
    }
  }

  // ---- observation --------------------------------------------------------

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan(document);
    });
  }

  const observer = new MutationObserver(() => queueScan());

  function startObserving() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", startObserving, {
        once: true,
      });
      return;
    }
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "data-tooltip", "title"],
    });
    scan(document);
  }

  // ---- pick mode ----------------------------------------------------------

  function clickableAncestor(el) {
    let node = el;
    for (let i = 0; i < 6 && node; i++) {
      if (
        node.matches &&
        node.matches('[role="button"], button, [role="menuitem"]')
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return el;
  }

  function signatureFor(el) {
    // Prefer a clean attribute; fall back to a trimmed text snippet.
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim();
    const tip = el.getAttribute("data-tooltip") || el.getAttribute("title");
    if (tip && tip.trim()) return tip.trim();
    const text = normalize(el.textContent);
    return text.slice(0, 60);
  }

  function capturePick(target) {
    const value = signatureFor(target);
    if (value) {
      const custom = settings.custom || [];
      if (!custom.some((c) => normalize(c.value) === normalize(value))) {
        custom.push({ type: "label", value: value });
        settings.custom = custom;
        save();
      }
      hide(target);
    }
  }

  // Block the real activation (Google buttons fire on pointerdown/mousedown) and
  // perform the selection on the first event we see, so picking a button never
  // triggers its action (e.g. opening the Beautify dialog).
  let pickHandled = false;

  function onPickEvent(ev) {
    if (!pickMode) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") {
      ev.stopImmediatePropagation();
    }
    if (ev.type === "pointerdown" || ev.type === "mousedown") {
      if (!pickHandled) {
        pickHandled = true;
        capturePick(clickableAncestor(ev.target));
      }
    } else if (ev.type === "click") {
      // Trailing click: capture here too if no down-event was seen, then exit.
      if (!pickHandled) {
        pickHandled = true;
        capturePick(clickableAncestor(ev.target));
      }
      setPickMode(false);
    }
  }

  const PICK_EVENTS = ["pointerdown", "mousedown", "mouseup", "click"];

  function setPickMode(on) {
    pickMode = on;
    pickHandled = false;
    document.documentElement.classList.toggle("nobanana-pick", on);
    for (const type of PICK_EVENTS) {
      if (on) {
        window.addEventListener(type, onPickEvent, true);
      } else {
        window.removeEventListener(type, onPickEvent, true);
      }
    }
  }

  // ---- persistence --------------------------------------------------------

  function save() {
    chrome.storage.sync.set({ [NB.STORAGE_KEY]: settings });
  }

  function applySettings(next) {
    settings = Object.assign({}, NB.DEFAULTS, next || {});
    // Gate the static CSS rules on the current settings.
    document.documentElement.classList.toggle(
      "nobanana-builtin",
      !!(settings.enabled && settings.useBuiltin)
    );
    unhideAll();
    if (settings.enabled) scan(document);
  }

  function load() {
    chrome.storage.sync.get(NB.STORAGE_KEY, (res) => {
      applySettings(res && res[NB.STORAGE_KEY]);
      startObserving();
    });
  }

  // React to changes from the popup/options pages in other tabs.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[NB.STORAGE_KEY]) {
      applySettings(changes[NB.STORAGE_KEY].newValue);
    }
  });

  // Messages from the popup (toggle pick mode, immediate re-scan).
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "nobanana:pick") {
      setPickMode(true);
      sendResponse && sendResponse({ ok: true });
    } else if (msg.type === "nobanana:cancelPick") {
      setPickMode(false);
      sendResponse && sendResponse({ ok: true });
    } else if (msg.type === "nobanana:rescan") {
      unhideAll();
      scan(document);
      sendResponse && sendResponse({ ok: true });
    }
    return true;
  });

  load();
})();
