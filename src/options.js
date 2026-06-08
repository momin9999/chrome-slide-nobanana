// Slides NoBanana — options page controller.
(function () {
  "use strict";

  const NB = window.NOBANANA;
  const $ = (id) => document.getElementById(id);

  let settings = Object.assign({}, NB.DEFAULTS);

  function load() {
    chrome.storage.sync.get(NB.STORAGE_KEY, (res) => {
      settings = Object.assign({}, NB.DEFAULTS, res && res[NB.STORAGE_KEY]);
      settings.custom = (settings.custom || []).slice();
      render();
    });
  }

  function save(showMsg) {
    chrome.storage.sync.set({ [NB.STORAGE_KEY]: settings }, () => {
      if (showMsg) {
        const m = $("savedMsg");
        m.hidden = false;
        setTimeout(() => (m.hidden = true), 1500);
      }
    });
  }

  function renderBuiltin() {
    const ul = $("builtinList");
    ul.innerHTML = "";
    for (const label of NB.DEFAULT_LABELS) {
      const li = document.createElement("li");
      li.textContent = label;
      ul.appendChild(li);
    }
  }

  function renderCustom() {
    const ul = $("customList");
    ul.innerHTML = "";
    if (!settings.custom.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "登録はまだありません。";
      ul.appendChild(li);
      return;
    }
    settings.custom.forEach((c, i) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = c.value;
      const btn = document.createElement("button");
      btn.className = "remove";
      btn.textContent = "削除";
      btn.addEventListener("click", () => {
        settings.custom.splice(i, 1);
        save(true);
        renderCustom();
      });
      li.appendChild(span);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function render() {
    renderBuiltin();
    renderCustom();
  }

  function addLabel() {
    const input = $("addInput");
    const value = input.value.trim();
    if (!value) return;
    const exists = settings.custom.some(
      (c) => c.value.trim().toLowerCase() === value.toLowerCase()
    );
    if (!exists) {
      settings.custom.push({ type: "label", value: value });
      save(true);
      renderCustom();
    }
    input.value = "";
    input.focus();
  }

  $("addBtn").addEventListener("click", addLabel);
  $("addInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addLabel();
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("設定をすべて初期状態に戻します。よろしいですか？")) return;
    settings = Object.assign({}, NB.DEFAULTS, { custom: [] });
    save(true);
    render();
  });

  load();
})();
