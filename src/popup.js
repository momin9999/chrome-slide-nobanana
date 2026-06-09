// Slides NoBanana — popup controller.
(function () {
  "use strict";

  const NB = window.NOBANANA;
  const $ = (id) => document.getElementById(id);

  let settings = Object.assign({}, NB.DEFAULTS);

  function load() {
    chrome.storage.sync.get(NB.STORAGE_KEY, (res) => {
      settings = Object.assign({}, NB.DEFAULTS, res && res[NB.STORAGE_KEY]);
      render();
    });
  }

  function save() {
    chrome.storage.sync.set({ [NB.STORAGE_KEY]: settings });
  }

  function render() {
    $("enabled").checked = !!settings.enabled;
    $("useBuiltin").checked = !!settings.useBuiltin;
    $("notesBoost").checked = !!settings.notesBoost;
    const n = (settings.custom || []).length;
    $("customCount").textContent =
      n > 0 ? `選択して登録: ${n} 件` : "選択登録なし";
  }

  function activeSlidesTab(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const ok =
        tab &&
        tab.url &&
        tab.url.startsWith("https://docs.google.com/presentation/");
      cb(ok ? tab : null);
    });
  }

  // ---- events -------------------------------------------------------------

  $("enabled").addEventListener("change", (e) => {
    settings.enabled = e.target.checked;
    save();
  });

  $("useBuiltin").addEventListener("change", (e) => {
    settings.useBuiltin = e.target.checked;
    save();
  });

  $("notesBoost").addEventListener("change", (e) => {
    settings.notesBoost = e.target.checked;
    save();
  });

  $("pick").addEventListener("click", () => {
    activeSlidesTab((tab) => {
      if (!tab) {
        $("notSlides").hidden = false;
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "nobanana:pick" }, () => {
        // Ignore lastError; content script may still be initializing.
        void chrome.runtime.lastError;
        const status = $("pickStatus");
        status.hidden = false;
        status.textContent =
          "選択モードを開始しました。スライドのタブで消したいボタンをクリックしてください。";
        // The popup closes when the user clicks back into the page, which is
        // expected — pick mode lives in the content script.
        setTimeout(() => window.close(), 1200);
      });
    });
  });

  $("openOptions").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("src/options.html"));
    }
  });

  // Surface a hint when the popup is opened outside Google Slides.
  activeSlidesTab((tab) => {
    if (!tab) $("notSlides").hidden = false;
  });

  load();
})();
