import { ref } from 'vue';

export interface ToastItem {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error';
}

const items = ref<ToastItem[]>([]);
let seed = 0;

export function toast(text: string, type: ToastItem['type'] = 'info', duration = 2600) {
  const id = ++seed;
  items.value.push({ id, text, type });
  setTimeout(() => {
    items.value = items.value.filter((t) => t.id !== id);
  }, duration);
}

export function useToast() {
  return { items };
}
