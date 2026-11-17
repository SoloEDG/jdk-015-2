<script setup lang="ts">
import type { Scene } from "../../../shared/types";
import type { History } from "../../history";
import { sceneField, useSlider } from "../../history";
import { themes } from "../model/themes";
const props = defineProps<{ scene: Scene; history: History }>();
// key 含场景 id：拖动中切换场景时，新场景的拖动另起一步，互不吞并。
const intensity = useSlider(
  props.history,
  () => sceneField(props.scene.id, "intensity"),
  "视觉强度",
  () => `slider:intensity:${props.scene.id}`,
);
const speed = useSlider(
  props.history,
  () => sceneField(props.scene.id, "speed"),
  "运动速度",
  () => `slider:speed:${props.scene.id}`,
);
function pick(theme: string) {
  props.history.set(
    sceneField(props.scene.id, "theme"),
    theme,
    "切换主题",
  );
}
</script>
<template>
  <section class="panel themes">
    <div class="panel-heading">
      <span>03 / VISUAL PALETTE</span><span>4 THEMES</span>
    </div>
    <div class="theme-options">
      <button
        v-for="t in themes"
        :key="t.id"
        :class="{ selected: scene.theme === t.id }"
        @click="pick(t.id)"
      >
        <span
          class="swatch"
          :style="{
            background: `linear-gradient(130deg,${t.background},${t.colors[0]},${t.colors[1]})`,
          }"
          ><span v-if="scene.theme === t.id">✓</span></span
        >{{ t.name }}
      </button>
    </div>
    <div class="two-controls">
      <label class="control"
        >视觉强度 <b>{{ Math.round(scene.intensity * 100) }}%</b
        ><input
          type="range"
          min="0.1"
          max="1.5"
          step="0.05"
          v-model.number="intensity.value"
          v-on="intensity.on" /></label
      ><label class="control"
        >运动速度 <b>{{ scene.speed.toFixed(1) }}×</b
        ><input
          type="range"
          min="0.1"
          max="2"
          step="0.1"
          v-model.number="speed.value"
          v-on="speed.on"
      /></label>
    </div>
  </section>
</template>
