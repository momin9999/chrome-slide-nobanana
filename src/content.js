// Slides NoBanana — content script.
//
// Hides the Gemini / Nano Banana generative-AI "nudge" button ("このスライドを
// ブラッシュアップ" / "Beautify this slide") that Google Slides renders between
// the slide canvas and the speaker-notes area. It is identified by two signals:
//   1. The descriptive "GenerativeAiNudgeButton" CSS class (locale-independent).
//   2. Its accessible name (aria-label / tooltip / text) as a backup.
// When a match is found we collapse the whole nudge container so the button,
// its × dismiss control and ripple all disappear. A MutationObserver keeps it
// hidden as the single-page app re-renders and as the user switches slides.
//
// A "pick mode" lets the user click the button once to capture a stable
// signature for it — useful if the class and labels ever change.

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

  // Read class as a plain string (SVG elements expose className as an object).
  function classOf(el) {
    return (el && el.getAttribute && el.getAttribute("class")) || "";
  }

  // Given a matched element, hide the outermost nudge container so the button,
  // its × dismiss control and the ripple all disappear together (and we don't
  // leave an empty, space-consuming wrapper between the slide and the notes).
  function hideTarget(el) {
    let root =
      el.closest && el.closest("." + NB.NUDGE_ROOT_CLASS);
    if (!root) {
      // Walk up while the parent is still tagged as the gen-AI nudge.
      let node = el;
      while (
        node.parentElement &&
        /GenerativeAiNudgeButton/.test(classOf(node.parentElement))
      ) {
        node = node.parentElement;
      }
      root = /GenerativeAiNudgeButton/.test(classOf(el)) ? node : el;
    }
    hide(root);
  }

  // Candidate elements: button-like roles plus anything carrying an accessible
  // label/tooltip (the chip is sometimes a labeled container, not a <button>).
  // We still only hide on a specific label match, so this stays safe and
  // survives re-renders when switching slides.
  const CANDIDATE_SELECTOR =
    '[role="button"], button, [aria-label], [data-tooltip]';

  function scan() {
    if (!settings.enabled) return;
    // 1. Stable class-based signal (locale-independent), part of the built-in
    //    ruleset so it follows the "use built-in" toggle.
    if (settings.useBuiltin) {
      try {
        document.querySelectorAll(NB.NUDGE_SELECTOR).forEach(hideTarget);
      } catch (e) {
        /* ignore selector/DOM errors */
      }
    }
    // 2. Label-based matching (built-in labels + user picks).
    let nodes;
    try {
      nodes = document.querySelectorAll(CANDIDATE_SELECTOR);
    } catch (e) {
      return;
    }
    for (const el of nodes) {
      if (shouldHide(el)) hideTarget(el);
    }
  }

  // ---- speaker-notes boost ------------------------------------------------
  //
  // Open the editor's speaker-notes pane a little by default. Rather than fight
  // Google's layout with CSS (the pane height is JS-controlled), we simulate a
  // short drag on the SplitPane handle between the slide canvas and the notes,
  // so Google's own code reflows the canvas correctly. We do this at most once
  // per page load, never shrink a pane the user already widened, and silently
  // no-op if the handle isn't present (e.g. notes hidden, or DOM changed).

  let notesBoosted = false;

  // The editor has more than one SplitPane (the left filmstrip divider is one
  // too). The canvas/notes divider is the horizontal bar you drag *vertically*,
  // so it is the visible handle that is wider than it is tall. Pick that one to
  // avoid ever resizing the filmstrip by mistake.
  function notesHandle() {
    const handles = document.querySelectorAll(NB.NOTES_HANDLE_SELECTOR);
    for (const h of handles) {
      const r = h.getBoundingClientRect();
      if (r.width > r.height && r.width > 0 && r.height > 0) return h;
    }
    return null;
  }

  // Current notes-pane height, scoped to the chosen handle's own SplitPane so we
  // never read the filmstrip's second container.
  function notesPaneHeight(handle) {
    const pane =
      (handle.parentElement &&
        handle.parentElement.querySelector(NB.NOTES_PANE_SELECTOR)) ||
      null;
    return pane ? Math.round(pane.getBoundingClientRect().height) : 0;
  }

  function dispatchMouse(target, type, x, y) {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        clientX: x,
        clientY: y,
      })
    );
  }

  // Drag the handle up by `dy` pixels (up = taller notes) using a mousedown on
  // the handle followed by document-level mousemove/up, matching how Closure's
  // dragger listens once a drag has started.
  function dragHandleUp(handle, dy) {
    const r = handle.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y0 = Math.round(r.top + r.height / 2);
    dispatchMouse(handle, "mousedown", x, y0);
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      dispatchMouse(document, "mousemove", x, y0 - Math.round((dy * i) / steps));
    }
    dispatchMouse(document, "mouseup", x, y0 - dy);
  }

  function boostNotes() {
    if (notesBoosted || !settings.notesBoost) return;
    const handle = notesHandle();
    if (!handle) return; // notes pane not shown yet (or absent)
    const current = notesPaneHeight(handle);
    // Already as open as we'd make it (or the user widened it): leave it alone.
    if (current >= NB.NOTES_BOOST_PX) {
      notesBoosted = true;
      return;
    }
    notesBoosted = true; // one shot, even if the drag is a partial no-op
    try {
      dragHandleUp(handle, NB.NOTES_BOOST_PX - current);
    } catch (e) {
      /* layout differs from expectations — leave the pane untouched */
    }
  }

  // ---- observation --------------------------------------------------------

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan();
      boostNotes();
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
    scan();
    boostNotes();
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
      hideTarget(target);
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
    const prevNotesBoost = settings.notesBoost;
    settings = Object.assign({}, NB.DEFAULTS, next || {});
    // Gate the static CSS rules on the current settings.
    document.documentElement.classList.toggle(
      "nobanana-builtin",
      !!(settings.enabled && settings.useBuiltin)
    );
    unhideAll();
    if (settings.enabled) scan();
    // Newly switched on: allow the one-shot boost to run again.
    if (settings.notesBoost && !prevNotesBoost) notesBoosted = false;
    boostNotes();
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
      scan();
      sendResponse && sendResponse({ ok: true });
    }
    return true;
  });

  load();
})();
