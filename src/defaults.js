// Shared configuration for Slides NoBanana.
// Loaded both as a content script (first, so content.js can read it) and via a
// <script> tag in the popup/options pages. Works in either context by attaching
// to the global object.
(function (root) {
  // Substrings matched (case-insensitive, whitespace-collapsed) against a
  // button's accessible name: aria-label, data-tooltip, title, then text.
  // Target: the Gemini / Nano Banana "Beautify this slide" button that appears
  // between the slide canvas and the speaker notes. We deliberately list the
  // long, specific phrases so we never touch unrelated controls.
  const DEFAULT_LABELS = [
    // English
    "beautify this slide",
    "beautify slide",
    // Japanese (exact wording varies by rollout; these are the likely variants)
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
    DEFAULT_LABELS: DEFAULT_LABELS,
    NEVER_LABELS: NEVER_LABELS,
    STORAGE_KEY: "nobanana_settings",
    // Default persisted settings.
    DEFAULTS: {
      enabled: true, // master on/off
      useBuiltin: true, // use the built-in DEFAULT_LABELS list
      custom: [], // user-added signatures: [{ type: "label", value: "..." }]
    },
  });
})(typeof self !== "undefined" ? self : this);
