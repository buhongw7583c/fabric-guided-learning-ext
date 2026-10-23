const STORAGE_KEY = "fabric_guided_learning_state_v1";

document.getElementById("btn-show").addEventListener("click", () => {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const cur = (res && res[STORAGE_KEY]) || {};
    chrome.storage.local.set({
      [STORAGE_KEY]: { ...cur, isDismissed: false, isOpen: true, isActive: true }
    });
  });
});

document.getElementById("btn-hide").addEventListener("click", () => {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const cur = (res && res[STORAGE_KEY]) || {};
    chrome.storage.local.set({
      [STORAGE_KEY]: { ...cur, isDismissed: true, isActive: false }
    });
  });
});
