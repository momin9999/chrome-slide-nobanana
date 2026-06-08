// Sanity test for the label-matching rules shared via src/defaults.js.
// Mirrors the predicate logic in content.js (normalize + includes + protection)
// so we can verify behavior without a browser.
const NB = require("../src/defaults.js").NOBANANA;

const normalize = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

function activeLabels({ useBuiltin = true, custom = [] } = {}) {
  const out = [];
  if (useBuiltin) for (const l of NB.DEFAULT_LABELS) out.push(normalize(l));
  for (const c of custom) if (c && c.value) out.push(normalize(c.value));
  return out;
}

function isProtected(name) {
  return NB.NEVER_LABELS.some((n) => name.includes(normalize(n)));
}

function shouldHide(rawName, settings) {
  const name = normalize(rawName);
  if (!name) return false;
  if (isProtected(name)) return false;
  return activeLabels(settings).some((l) => l && name.includes(l));
}

const cases = [
  // [accessibleName, settings, expectedHidden, description]
  ["Beautify this slide", {}, true, "English beautify button"],
  ["auto_awesome Beautify this slide", {}, true, "with icon ligature prefix"],
  ["このスライドをブラッシュアップ", {}, true, "confirmed live JA label"],
  [
    "このスライドをブラッシュアップ を閉じる",
    {},
    true,
    "the dismiss (×) button label also matches",
  ],
  ["このスライドを改善", {}, true, "Japanese improve-slide button"],
  ["スライドを改善する", {}, true, "Japanese improve variant (suffix)"],
  ["Ask Gemini", {}, false, "Ask Gemini must be preserved"],
  ["Gemini に相談", {}, false, "Ask Gemini (JA) must be preserved"],
  ["Insert image", {}, false, "unrelated button untouched"],
  ["", {}, false, "empty name untouched"],
  [
    "Beautify this slide",
    { useBuiltin: false },
    false,
    "built-in off => not hidden",
  ],
  [
    "Make it pop",
    { custom: [{ value: "Make it pop" }] },
    true,
    "custom picked label matches",
  ],
  [
    "Beautify this slide",
    { useBuiltin: false, custom: [{ value: "beautify" }] },
    true,
    "custom substring still matches",
  ],
];

let failed = 0;
for (const [name, settings, expected, desc] of cases) {
  const got = shouldHide(name, settings);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${desc}  (got=${got}, want=${expected})`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
