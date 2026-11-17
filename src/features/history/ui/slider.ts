import { computed } from "vue";
import type { History, Path } from "../model/history";

/**
 * 绑定一个可撤销的滑杆：
 * - 一次连续拖动（pointerdown → pointerup）合并为一步历史；
 * - 键盘连续微调在短时间窗口内合并为一步；
 * - 拖动中按 Esc 或指针被取消时，仅回退本次未提交的修改，
 *   拖动期间已提交的场景切换等操作保持生效。
 */
export function useSlider(
  history: History,
  path: () => Path,
  label: string,
  key?: () => string,
) {
  const gestureKey = () => key?.() ?? `slider:${label}`;
  const value = computed<number>({
    get: () => history.read(path()) as number,
    set: (v) => history.set(path(), v, label, gestureKey()),
  });
  const on = {
    onPointerdown: () => history.begin(gestureKey(), label),
    onPointerup: () => history.end(gestureKey()),
    onPointercancel: () => history.cancel(gestureKey()),
    onChange: () => history.end(gestureKey()),
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        history.cancel(gestureKey());
      }
    },
  };
  return { value, on };
}
