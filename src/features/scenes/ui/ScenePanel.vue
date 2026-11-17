<script setup lang="ts">
import { Copy } from "lucide-vue-next";
import type { StageDocument } from "../../../shared/types";
import type { SceneStore } from "../model/sceneStore";
import type { History } from "../../history";
import { useSlider } from "../../history";
import { catalog } from "../lib/catalog";
const props = defineProps<{
  doc: StageDocument;
  store: SceneStore;
  history: History;
}>();
const transition = useSlider(props.history, () => ["transition"], "场景过渡");
</script>
<template>
  <section class="panel scene-panel">
    <div class="panel-heading">
      <span>02 / SCENE COLLECTION</span
      ><span>{{ String(doc.scenes.length).padStart(2, "0") }}</span>
    </div>
    <div
      v-for="(s, i) in doc.scenes"
      :key="s.id"
      class="scene-row"
      :class="{ active: doc.activeId === s.id }"
    >
      <button class="scene-select" @click="store.select(s.id)">
        <div class="scene-thumb" :class="s.kind">
          {{ catalog.find((c) => c.kind === s.kind)?.icon }}
        </div>
        <div>
          <strong>{{ s.name }}</strong
          ><small>{{
            catalog.find((c) => c.kind === s.kind)?.description
          }}</small>
        </div>
        <kbd>{{ i + 1 }}</kbd>
      </button>
      <button
        class="scene-duplicate"
        :aria-label="`复制场景 ${s.name}`"
        :title="`复制场景 ${s.name}`"
        @click="store.duplicate(s.id)"
      >
        <Copy :size="13" />
      </button>
    </div>
    <label class="control"
      >场景过渡 <b>{{ doc.transition.toFixed(1) }}s</b
      ><input
        type="range"
        min="0"
        max="4"
        step="0.1"
        v-model.number="transition.value"
        v-on="transition.on"
    /></label>
  </section>
</template>
