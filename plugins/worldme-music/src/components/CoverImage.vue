<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';

withDefaults(defineProps<{ src?: string; size?: number | string; radius?: number | string }>(), {
  size: 48,
  radius: 12,
});

const failed = ref(false);
</script>

<template>
  <div
    class="cover"
    :style="{ width: typeof size === 'number' ? size + 'px' : size, height: typeof size === 'number' ? size + 'px' : size, borderRadius: typeof radius === 'number' ? radius + 'px' : radius }"
  >
    <img v-if="src && !failed" :src="src" loading="lazy" @error="failed = true" alt="" />
    <div v-else class="fallback"><Icon name="music" :size="'46%'" /></div>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(236, 72, 153, 0.28));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
}
</style>
