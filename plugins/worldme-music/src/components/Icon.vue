<script setup lang="ts">
const props = withDefaults(
  defineProps<{ name: string; size?: number | string; stroke?: number }>(),
  { size: 20, stroke: 2 }
);

const ICONS: Record<string, { body: string; filled?: boolean }> = {
  search: { body: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-3.6-3.6"/>' },
  play: { body: '<path d="M7 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L8.53 4.65A1 1 0 0 0 7 5.5z"/>', filled: true },
  pause: { body: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.4"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.4"/>', filled: true },
  prev: { body: '<path d="M18 5.5v13a1 1 0 0 1-1.53.85L7 13.6V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v4.4l9.47-5.75A1 1 0 0 1 18 5.5z"/>', filled: true },
  next: { body: '<path d="M6 5.5v13a1 1 0 0 0 1.53.85L17 13.6V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.4L7.53 4.65A1 1 0 0 0 6 5.5z"/>', filled: true },
  'volume': { body: '<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/>' },
  'volume-mute': { body: '<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>' },
  heart: { body: '<path d="M12 20s-7-4.4-9-8.6C1.6 8.2 3.6 5 7 5c2 0 3.2 1.1 4 2.2C11.8 6.1 13 5 15 5c3.4 0 5.4 3.2 4 6.4C19 15.6 12 20 12 20z"/>' },
  'heart-fill': { body: '<path d="M12 20.4s-7.4-4.7-9.5-9.1C1 7.6 3.2 4.4 6.9 4.4c2 0 3.5 1.1 4.4 2.4l.7 1 .7-1c.9-1.3 2.4-2.4 4.4-2.4 3.7 0 5.9 3.2 4.4 6.9C19.4 15.7 12 20.4 12 20.4z"/>', filled: true },
  list: { body: '<path d="M4 6.5h11M4 12h11M4 17.5h7"/><circle cx="18" cy="6.5" r="1.4"/><circle cx="18" cy="12" r="1.4"/><circle cx="18" cy="17.5" r="1.4"/>' },
  music: { body: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
  disc: { body: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6"/>' },
  history: { body: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4h4"/><path d="M12 8v4.5l3 1.8"/>' },
  settings: { body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l1.7-1.3-2-3.4-2 .8a7.6 7.6 0 0 0-2.6-1.5L14.2 2h-4l-.3 2.1a7.6 7.6 0 0 0-2.6 1.5l-2-.8-2 3.4L5 9.5a7.9 7.9 0 0 0 0 3l-1.7 1.3 2 3.4 2-.8a7.6 7.6 0 0 0 2.6 1.5l.3 2.1h4l.3-2.1a7.6 7.6 0 0 0 2.6-1.5l2 .8 2-3.4-1.7-1.3z"/>' },
  plus: { body: '<path d="M12 5v14M5 12h14"/>' },
  minus: { body: '<path d="M5 12h14"/>' },
  trash: { body: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>' },
  refresh: { body: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>' },
  'chevron-down': { body: '<path d="M6 9l6 6 6-6"/>' },
  'chevron-right': { body: '<path d="M9 6l6 6-6 6"/>' },
  close: { body: '<path d="M6 6l12 12M18 6L6 18"/>' },
  expand: { body: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>' },
  compress: { body: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>' },
  loop: { body: '<path d="M4 9a5 5 0 0 1 5-5h9l-2.5-2.5M20 15a5 5 0 0 1-5 5H6l2.5 2.5"/><path d="M18 4l-2.5 2.5M6 20l2.5 2.5"/>' },
  'loop-one': { body: '<path d="M4 9a5 5 0 0 1 5-5h9l-2.5-2.5M20 15a5 5 0 0 1-5 5H6l2.5 2.5"/><path d="M12.5 10.5l1.2-.8V15"/>' },
  shuffle: { body: '<path d="M4 6h3.5l3 3M20 6h-4l-9 12H4M20 18h-4l-1.5-2"/><path d="M18 4l2 2-2 2M18 16l2 2-2 2"/>' },
  download: { body: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>' },
  link: { body: '<path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2"/><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2"/>' },
  code: { body: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>' },
  check: { body: '<path d="M5 12.5l4.5 4.5L19 7"/>' },
  more: { body: '<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>', filled: true },
  upload: { body: '<path d="M12 20V9M8 13l4-4 4 4M5 4h14"/>' },
  folder: { body: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>' },
  info: { body: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.1"/>' },
  sparkles: { body: '<path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/>' },
  cloud: { body: '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9.5a3.5 3.5 0 0 1 .5 7H7z"/>' },
  edit: { body: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>' },
  'arrow-up': { body: '<path d="M12 19V5M6 11l6-6 6 6"/>' },
  'arrow-down': { body: '<path d="M12 5v14M6 13l6 6 6-6"/>' },
};
</script>

<template>
  <svg
    class="wm-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="ICONS[props.name]?.filled ? 'currentColor' : 'none'"
    :stroke="ICONS[props.name]?.filled ? 'none' : 'currentColor'"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-html="ICONS[props.name]?.body || ''"
  />
</template>

<style scoped>
.wm-icon {
  display: block;
  flex-shrink: 0;
}
</style>
