<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }>(),
  { min: 0, max: 1, step: 0.001 }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'dragstart'): void;
  (e: 'dragend', value: number): void;
}>();

const el = ref<HTMLElement | null>(null);
const dragging = ref(false);

const percent = computed(() => {
  const range = props.max - props.min;
  const ratio = range ? (props.modelValue - props.min) / range : 0;
  return Math.max(0, Math.min(1, isFinite(ratio) ? ratio : 0)) * 100;
});

function valueFromClientX(x: number): number {
  const rect = el.value!.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
  let v = props.min + ratio * (props.max - props.min);
  if (props.step) v = Math.round(v / props.step) * props.step;
  return v;
}

function onDown(e: PointerEvent) {
  if (props.disabled) return;
  dragging.value = true;
  el.value?.setPointerCapture(e.pointerId);
  emit('dragstart');
  emit('update:modelValue', valueFromClientX(e.clientX));
}
function onMove(e: PointerEvent) {
  if (!dragging.value) return;
  emit('update:modelValue', valueFromClientX(e.clientX));
}
function onUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  emit('dragend', valueFromClientX(e.clientX));
}
</script>

<template>
  <div
    ref="el"
    class="slider"
    :class="{ dragging, disabled }"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <div class="track">
      <div class="fill" :style="{ width: percent + '%' }"></div>
    </div>
    <div class="thumb" :style="{ left: percent + '%' }"></div>
  </div>
</template>

<style scoped>
.slider {
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  flex: 1;
}
.slider.disabled {
  cursor: default;
  opacity: 0.5;
}
.track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 4px;
  background: var(--border-strong);
  overflow: hidden;
}
.fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 4px;
  background: var(--accent-grad);
  transition: width 0.05s linear;
}
.thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.16s ease;
}
.slider:hover .thumb,
.slider.dragging .thumb {
  transform: translate(-50%, -50%) scale(1);
}
</style>
