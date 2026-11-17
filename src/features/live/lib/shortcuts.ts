export function bindShortcuts(actions: {
  play: () => void;
  scene: (i: number) => void;
  blackout: () => void;
  freeze: () => void;
  tap: () => void;
  undo: () => void;
  redo: () => void;
}) {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      // 文本类控件里保留浏览器原生撤销；滑杆/按钮上走演出历史。
      if (
        target?.closest(
          "textarea,[contenteditable],input:not([type='range']):not([type='checkbox']):not([type='button'])",
        )
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
      } else if (key === "y") {
        e.preventDefault();
        actions.redo();
      }
      return;
    }
    if (
      target?.closest("input,textarea,select,button") ||
      e.repeat ||
      e.metaKey ||
      e.ctrlKey
    )
      return;
    if (e.code === "Space") {
      e.preventDefault();
      actions.play();
    }
    if (/^[1-4]$/.test(e.key)) actions.scene(Number(e.key) - 1);
    if (e.key.toLowerCase() === "b") actions.blackout();
    if (e.key.toLowerCase() === "f") actions.freeze();
    if (e.key.toLowerCase() === "t") actions.tap();
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
