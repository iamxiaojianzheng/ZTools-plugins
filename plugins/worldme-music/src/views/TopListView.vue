<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import MediaCard from '@/components/MediaCard.vue';
import { useSourceStore } from '@/stores/sources';
import { useDetailStore } from '@/stores/detail';
import { services } from '@/api/services';
import { useUiStore } from '@/stores/ui';

const sources = useSourceStore();
const detail = useDetailStore();
const ui = useUiStore();

const activeHash = ref('');
const groups = ref<any[]>([]);
const loading = ref(false);

const activeSource = computed(() => sources.enabled.find((s) => s.hash === activeHash.value));

async function load() {
  if (!activeHash.value) {
    groups.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await services().music.getTopLists(activeHash.value);
    groups.value = Array.isArray(res) ? res : [];
  } catch (e) {
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function select(hash: string) {
  if (activeHash.value === hash) return;
  activeHash.value = hash;
  load();
}

function openItem(item: any) {
  const src = activeSource.value;
  const enriched = {
    ...item,
    platform: item.platform || src?.platform || '',
    artwork: item.artwork || item.coverImg || '',
  };
  detail.openDetail('toplist', enriched, activeHash.value);
}

watch(
  () => sources.enabled.map((s) => s.hash).join(','),
  () => {
    if (!sources.enabled.find((s) => s.hash === activeHash.value)) {
      activeHash.value = sources.enabled[0]?.hash || '';
      load();
    }
  }
);

onMounted(() => {
  activeHash.value = sources.enabled[0]?.hash || '';
  load();
});
</script>

<template>
  <div class="view">
    <div class="head">
      <div>
        <h2>排行榜</h2>
        <p class="text-2">来自各音源的榜单与精选</p>
      </div>
      <button class="btn ghost" :disabled="!activeHash || loading" @click="load">
        <Icon name="refresh" :size="15" :class="{ spin: loading }" />刷新
      </button>
    </div>

    <div v-if="!sources.enabled.length" class="empty card">
      <div class="empty-art"><Icon name="disc" :size="40" /></div>
      <h3>还没有可用音源</h3>
      <p class="text-2">添加音源后即可浏览榜单</p>
      <button class="btn primary" @click="ui.setView('sources')"><Icon name="plus" :size="15" />添加音源</button>
    </div>

    <template v-else>
      <div class="tabs">
        <button
          v-for="s in sources.enabled"
          :key="s.hash"
          class="tab"
          :class="{ on: activeHash === s.hash }"
          @click="select(s.hash)"
        >
          {{ s.platform }}
        </button>
      </div>

      <div v-if="loading" class="grid">
        <div v-for="i in 10" :key="i" class="sk-card">
          <div class="skeleton" style="width: 100%; aspect-ratio: 1; border-radius: 16px"></div>
          <div class="skeleton" style="width: 70%; height: 12px; margin-top: 10px"></div>
        </div>
      </div>

      <div v-else-if="!groups.length" class="empty card small">
        <Icon name="info" :size="22" />
        <p class="text-2">该音源暂未提供榜单</p>
      </div>

      <div v-else class="groups">
        <section v-for="(g, gi) in groups" :key="gi" class="group">
          <h3 v-if="g.title">{{ g.title }}</h3>
          <div class="grid">
            <MediaCard
              v-for="(item, i) in g.data || []"
              :key="(item.platform || '') + item.id + i"
              :item="item"
              type="toplist"
              :platform="activeSource?.platform"
              @open="openItem(item)"
            />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.view {
  height: 100%;
  overflow-y: auto;
  padding: 4px 26px 26px;
}
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 6px 0 16px;
}
.head h2 {
  margin: 0 0 6px;
  font-size: 24px;
}
.head p {
  margin: 0;
  font-size: 13px;
}
.tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 16px;
  overflow-x: auto;
}
.tab {
  height: 32px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-2);
  background: var(--panel);
  border: 1px solid var(--border);
  white-space: nowrap;
  transition: all 0.16s ease;
}
.tab.on {
  color: #fff;
  background: var(--accent-grad);
  border-color: transparent;
}
.groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.group h3 {
  margin: 10px 0 14px;
  font-size: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 22px 18px;
}
.sk-card {
  min-width: 0;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 56px 24px;
  text-align: center;
}
.empty.small {
  padding: 38px 24px;
}
.empty-art {
  width: 84px;
  height: 84px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--accent-grad);
}
.empty h3 {
  margin: 6px 0 0;
}
.empty p {
  margin: 0;
  font-size: 13px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
</style>
