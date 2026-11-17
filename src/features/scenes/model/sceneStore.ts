import { computed } from "vue";
import type { StageDocument } from "../../../shared/types";
import type { History } from "../../history";
export function createScenes(doc: StageDocument, history: History) {
  const active = computed(
    () => doc.scenes.find((s) => s.id === doc.activeId) ?? doc.scenes[0],
  );
  function select(id: string) {
    if (doc.scenes.some((s) => s.id === id))
      history.set(["activeId"], id, "切换场景");
  }
  function next() {
    select(
      doc.scenes[
        (doc.scenes.findIndex((s) => s.id === doc.activeId) + 1) %
          doc.scenes.length
      ].id,
    );
  }
  /** 复制场景并切换过去，整组操作记为一步历史。 */
  function duplicate(id: string) {
    const i = doc.scenes.findIndex((s) => s.id === id);
    if (i < 0) return;
    const source = doc.scenes[i];
    const copy = {
      ...JSON.parse(JSON.stringify(source)),
      id: crypto.randomUUID(),
      name: `${source.name} 副本`,
    };
    history.batch("复制场景", () => {
      history.splice(["scenes"], i + 1, 0, [copy], "复制场景");
      history.set(["activeId"], copy.id, "切换场景");
    });
  }
  return { active, select, next, duplicate };
}
export type SceneStore = ReturnType<typeof createScenes>;
