import { reactive } from "vue";
import type { StageDocument } from "../../../shared/types";

/** 路径段：字符串/数字为普通属性；"#id" 表示在数组中按 id 定位（场景增删后仍然有效）。 */
export type Segment = string | number;
export type Path = Segment[];

export type Patch =
  | { kind: "set"; path: Path; before: unknown; after: unknown }
  | {
      kind: "splice";
      path: Path;
      index: number;
      removed: unknown[];
      inserted: unknown[];
    };

interface Entry {
  label: string;
  key: string | null;
  patches: Patch[];
  time: number;
}

/** 一次进行中的连续操作（如拖动滑杆），提交后成为一条历史记录。 */
interface Transaction {
  key: string;
  label: string;
  /** 显式手势（pointerdown 开始）只随 end/cancel 结束；否则闲置超时自动提交。 */
  explicit: boolean;
  patches: Map<string, Patch>;
  order: string[];
  timer: number;
  /** 最后一次实际修改的时间，用于提交后与后续同键编辑的合并判断。 */
  last: number;
}

/** 同键编辑的合并窗口：连续拖动/连续按键在此窗口内记为一步。 */
const MERGE_WINDOW = 800;
/** 历史容量：只保留最近一百次普通编辑，占用有界。 */
const DEFAULT_LIMIT = 100;

const clone = <T>(value: T): T =>
  value !== null && typeof value === "object"
    ? (JSON.parse(JSON.stringify(value)) as T)
    : value;

const pathKey = (path: Path) => path.join("");

function resolve(parent: unknown, seg: Segment): unknown {
  if (
    typeof seg === "string" &&
    seg.startsWith("#") &&
    Array.isArray(parent)
  )
    return parent.find((item) => item?.id === seg.slice(1));
  return (parent as Record<Segment, unknown>)?.[seg];
}

function getAt(root: unknown, path: Path): unknown {
  let node = root;
  for (const seg of path) node = resolve(node, seg);
  return node;
}

function setAt(root: unknown, path: Path, value: unknown) {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) node = resolve(node, path[i]);
  const last = path[path.length - 1];
  if (typeof last === "string" && last.startsWith("#") && Array.isArray(node)) {
    const i = node.findIndex((item) => item?.id === last.slice(1));
    if (i >= 0) node[i] = value;
  } else if (node != null) {
    (node as Record<Segment, unknown>)[last] = value;
  }
}

/** 场景字段路径，按场景 id 寻址，场景列表变化后仍能正确定位。 */
export const sceneField = (sceneId: string, field: string): Path => [
  "scenes",
  `#${sceneId}`,
  field,
];

export function createHistory(doc: StageDocument, limit = DEFAULT_LIMIT) {
  const state = reactive({
    canUndo: false,
    canRedo: false,
    undoLabel: "",
    redoLabel: "",
    size: 0,
  });
  const past: Entry[] = [];
  const future: Entry[] = [];
  let open: Transaction | null = null;
  let batching: Entry | null = null;
  let applying = false;

  function sync() {
    state.canUndo = past.length > 0 || open !== null;
    state.canRedo = future.length > 0;
    state.undoLabel = open
      ? open.label
      : (past[past.length - 1]?.label ?? "");
    state.redoLabel = future[future.length - 1]?.label ?? "";
    state.size = past.length + (open ? 1 : 0);
  }

  function push(entry: Entry) {
    past.push(entry);
    if (past.length > limit) past.shift();
    future.length = 0;
    sync();
  }

  function applyForward(patch: Patch) {
    if (patch.kind === "set") {
      setAt(doc, patch.path, clone(patch.after));
    } else {
      (getAt(doc, patch.path) as unknown[]).splice(
        patch.index,
        patch.removed.length,
        ...patch.inserted.map(clone),
      );
    }
  }

  function applyInverse(patch: Patch) {
    if (patch.kind === "set") {
      setAt(doc, patch.path, clone(patch.before));
    } else {
      (getAt(doc, patch.path) as unknown[]).splice(
        patch.index,
        patch.inserted.length,
        ...patch.removed.map(clone),
      );
    }
  }

  function record(patch: Patch, label: string, key: string | null) {
    if (batching) {
      batching.patches.push(patch);
      return;
    }
    if (key === null) {
      // 独立操作（按钮、切换、列表变更）：先提交进行中的拖动，再单独入栈。
      if (open) commit();
      push({ label, key: null, patches: [patch], time: performance.now() });
      return;
    }
    if (open && open.key !== key) commit();
    if (!open) {
      const top = past[past.length - 1];
      if (
        top &&
        top.key === key &&
        patch.kind === "set" &&
        performance.now() - top.time < MERGE_WINDOW
      ) {
        // 与上一条同键记录合并（如键盘连续微调），保持一步。
        const existing = top.patches.find(
          (p) => p.kind === "set" && pathKey(p.path) === pathKey(patch.path),
        );
        if (existing && existing.kind === "set") existing.after = patch.after;
        else top.patches.push(patch);
        top.time = performance.now();
        future.length = 0;
        sync();
        return;
      }
      open = {
        key,
        label,
        explicit: false,
        patches: new Map(),
        order: [],
        timer: 0,
        last: 0,
      };
    }
    open.last = performance.now();
    const k = pathKey(patch.path);
    const previous = open.patches.get(k);
    if (previous && previous.kind === "set" && patch.kind === "set") {
      previous.after = patch.after;
    } else {
      open.patches.set(k, patch);
      open.order.push(k);
    }
    if (!open.explicit) {
      clearTimeout(open.timer);
      open.timer = setTimeout(() => commit(key), MERGE_WINDOW);
    }
    sync();
  }

  /** 修改文档字段；传入相同 key 的连续修改会合并为一步。 */
  function set(path: Path, value: unknown, label: string, key?: string) {
    if (applying) return;
    const before = getAt(doc, path);
    if (Object.is(before, value)) return;
    const patch: Patch = {
      kind: "set",
      path: [...path],
      before: clone(before),
      after: clone(value),
    };
    setAt(doc, path, value);
    record(patch, label, key ?? null);
  }

  /** 数组变更（如复制场景），记录为一条可逆的 splice 补丁。 */
  function splice(
    path: Path,
    index: number,
    deleteCount: number,
    items: unknown[],
    label: string,
  ) {
    if (applying) return;
    const arr = getAt(doc, path) as unknown[];
    const patch: Patch = {
      kind: "splice",
      path: [...path],
      index,
      removed: arr.slice(index, index + deleteCount).map(clone),
      inserted: items.map(clone),
    };
    arr.splice(index, deleteCount, ...items.map(clone));
    record(patch, label, null);
  }

  /** 把多个操作合并为一条历史记录（如“复制场景”同时插入场景并切换）。 */
  function batch(label: string, fn: () => void) {
    if (open) commit();
    const outer = batching;
    const entry: Entry = { label, key: null, patches: [], time: 0 };
    batching = entry;
    try {
      fn();
    } finally {
      batching = outer;
      if (entry.patches.length) {
        entry.time = performance.now();
        if (outer) outer.patches.push(...entry.patches);
        else push(entry);
      }
    }
  }

  /** 开始一次显式手势（滑杆 pointerdown）；期间同键修改持续合并。 */
  function begin(key: string, label: string) {
    if (open && open.key === key) {
      open.explicit = true;
      clearTimeout(open.timer);
      return;
    }
    if (open) commit();
    open = {
      key,
      label,
      explicit: true,
      patches: new Map(),
      order: [],
      timer: 0,
      last: performance.now(),
    };
    sync();
  }

  /** 结束显式手势并提交为一步；非显式事务由闲置计时器提交，不受影响。 */
  function end(key?: string) {
    if (!open || (key !== undefined && open.key !== key) || !open.explicit)
      return;
    commit();
  }

  /**
   * 取消手势：只回退未提交的部分；
   * 手势期间已提交的历史（如场景切换）保持生效，不受影响。
   */
  function cancel(key?: string) {
    if (!open || (key !== undefined && open.key !== key)) return;
    clearTimeout(open.timer);
    const tx = open;
    open = null;
    applying = true;
    for (let i = tx.order.length - 1; i >= 0; i--)
      applyInverse(tx.patches.get(tx.order[i])!);
    applying = false;
    sync();
  }

  function commit(key?: string) {
    if (!open || (key !== undefined && open.key !== key)) return;
    clearTimeout(open.timer);
    const tx = open;
    open = null;
    if (tx.patches.size)
      push({
        label: tx.label,
        key: tx.key,
        patches: tx.order.map((k) => tx.patches.get(k)!),
        time: tx.last,
      });
    else sync();
  }

  function undo() {
    if (open) commit();
    const entry = past.pop();
    if (!entry) return;
    applying = true;
    for (let i = entry.patches.length - 1; i >= 0; i--)
      applyInverse(entry.patches[i]);
    applying = false;
    future.push(entry);
    sync();
  }

  function redo() {
    const entry = future.pop();
    if (!entry) return;
    applying = true;
    for (const patch of entry.patches) applyForward(patch);
    applying = false;
    past.push(entry);
    sync();
  }

  function read(path: Path) {
    return getAt(doc, path);
  }

  function dispose() {
    if (open) clearTimeout(open.timer);
    open = null;
  }

  return {
    state,
    set,
    splice,
    batch,
    begin,
    end,
    cancel,
    commit,
    undo,
    redo,
    read,
    dispose,
  };
}
export type History = ReturnType<typeof createHistory>;
