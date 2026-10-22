<script setup lang="ts">
import { useToast } from '@/composables/toast';
import Icon from './Icon.vue';

const { items } = useToast();
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="t in items" :key="t.id" class="toast" :class="t.type">
        <Icon :name="t.type === 'success' ? 'check' : t.type === 'error' ? 'close' : 'info'" :size="16" />
        <span>{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 108px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 4000;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--panel-solid);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  font-size: 13px;
  animation: floatUp 0.25s ease;
}
.toast.success {
  color: #34d399;
}
.toast.error {
  color: #f87171;
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
