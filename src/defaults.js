// Shared configuration for Slides NoBanana.
// Loaded both as a content script (first, so content.js can read it) and via a
// <script> tag in the popup/options pages. Works in either context by attaching
// to the global object.
(function (root) {
  // Stable, locale-independent selector for the generative-AI nudge. Google
  // gives this feature descriptive class names (not the obfuscated short ones),
  // e.g. the confirmed DOM:
  //   <div class="appsElementsGenerativeAiNudgeButtonNudgeRoot ...">
  //     <div role="button" aria-label="このスライドをブラッシュアップ" ...>
  //   ...
  // Matching the "GenerativeAiNudgeButton" class works regardless of the UI
  // language and survives minor suffix renames. content.js / content.css hide
  // the whole nudge container so the button, its dismiss (×) and ripple all go.
  const NUDGE_SELECTOR = '[class*="GenerativeAiNudgeButton"]';
  // The outer container we collapse when hiding (preferred over inner button).
  const NUDGE_ROOT_CLASS = "appsElementsGenerativeAiNudgeButtonNudgeRoot";

  // The Slides editor splits the slide canvas and the speaker-notes pane with a
  // Closure SplitPane. The draggable bar between them carries the standard
  // "goog-splitpane-handle" class; dragging it up enlarges the notes pane while
  // letting Google's own layout reflow the canvas. content.js opens the notes a
  // little by simulating a short drag on this handle (see NOTES_BOOST_PX).
  const NOTES_HANDLE_SELECTOR = ".goog-splitpane-handle";
  // The container Closure resizes for the notes pane (used to read its current
  // height so the boost stays idempotent and never shrinks a wider pane).
  const NOTES_PANE_SELECTOR = ".goog-splitpane-second-container";
  // How many extra pixels to open the notes pane to ("a little open"). The pane
  // is only nudged taller when it is currently shorter than this.
  const NOTES_BOOST_PX = 150;

  // Substrings matched (case-insensitive, whitespace-collapsed) against a
  // button's accessible name: aria-label, data-tooltip, title, then text.
  // Backup signal for when the class above ever changes; the confirmed live
  // label is "このスライドをブラッシュアップ".
  const DEFAULT_LABELS = [
    // English (wording varies by rollout)
    "beautify this slide",
    "beautify slide",
    "brush up this slide",
    "brush up slide",
    // Japanese — confirmed live label + likely variants
    "このスライドをブラッシュアップ",
    "ブラッシュアップ",
    "このスライドを改善",
    "スライドを改善",
    "スライドを美しく",
    "スライドをきれいに",
  ];

  // Labels that must NEVER be hidden. The user asked to keep the top-right
  // "Ask Gemini" sparkle button, so guard against ever matching it. Keep these
  // specific — a bare "gemini" would wrongly protect the beautify button too.
  const NEVER_LABELS = ["ask gemini", "gemini に相談", "geminiに相談"];

  root.NOBANANA = root.NOBANANA || {};
  Object.assign(root.NOBANANA, {
    NUDGE_SELECTOR: NUDGE_SELECTOR,
    NUDGE_ROOT_CLASS: NUDGE_ROOT_CLASS,
    NOTES_HANDLE_SELECTOR: NOTES_HANDLE_SELECTOR,
    NOTES_PANE_SELECTOR: NOTES_PANE_SELECTOR,
    NOTES_BOOST_PX: NOTES_BOOST_PX,
    DEFAULT_LABELS: DEFAULT_LABELS,
    NEVER_LABELS: NEVER_LABELS,
    STORAGE_KEY: "nobanana_settings",
    // Default persisted settings.
    DEFAULTS: {
      enabled: true, // master on/off
      useBuiltin: true, // use the built-in nudge selector + label list
      custom: [], // user-added signatures: [{ type: "label", value: "..." }]
      notesBoost: true, // open the speaker-notes pane a little by default
    },
  });
})(typeof self !== "undefined" ? self : this);
