const { ipcRenderer } = require("electron");

function emitSelection() {
  const text = window.getSelection?.()?.toString?.().trim() ?? "";
  ipcRenderer.send("guest:selection-change", { text });
}

window.addEventListener("DOMContentLoaded", () => {
  emitSelection();
});

document.addEventListener(
  "selectionchange",
  () => {
    window.requestAnimationFrame(emitSelection);
  },
  true,
);

window.addEventListener("mouseup", emitSelection, true);
window.addEventListener("keyup", emitSelection, true);
window.addEventListener("blur", emitSelection, true);
