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
    DEFAULT_LABELS: DEFAULT_LABELS,
    NEVER_LABELS: NEVER_LABELS,
    STORAGE_KEY: "nobanana_settings",
    // Default persisted settings.
    DEFAULTS: {
      enabled: true, // master on/off
      useBuiltin: true, // use the built-in nudge selector + label list
      custom: [], // user-added signatures: [{ type: "label", value: "..." }]
    },
  });
})(typeof self !== "undefined" ? self : this);
