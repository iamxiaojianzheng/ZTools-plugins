export interface MusicItem {
  platform: string;
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  duration?: number;
  url?: string;
  lrc?: string;
  rawLrc?: string;
  /** 本地附加：所在音源 hash（便于重新解析） */
  $$hash?: string;
  [k: string]: any;
}

export interface SourceMeta {
  hash: string;
  platform: string;
  title?: string;
  author?: string;
  version?: string;
  srcUrl?: string;
  primaryKey?: string[];
  cacheControl?: string;
  supportedSearchType?: string[];
  userVariables?: Array<{ key: string; title?: string; hint?: string; name?: string }>;
  /** 用户填写的变量值（按 key） */
  userVariableValues?: Record<string, string>;
  enabled: boolean;
  order: number;
  stateCode?: string;
  errorMessage?: string;
  installedAt?: number;
  updatedAt?: number;
  [k: string]: any;
}

export interface SubscriptionEntry {
  name: string;
  url: string;
  version?: string;
}

export interface InstallProgress {
  phase: 'install';
  done: number;
  total: number;
  current: string;
  status: 'start' | 'running' | 'ok' | 'fail';
  error?: string;
  platform?: string;
  version?: string;
}

export interface InstallResultItem {
  name: string;
  url: string;
  ok: boolean;
  platform?: string;
  version?: string;
  error?: string;
}

export interface InstallSummary {
  ok: number;
  failed: number;
  total: number;
  results: InstallResultItem[];
}

export interface ProxyConfig {
  mode: 'auto' | 'off' | 'manual';
  url: string;
  mirror: boolean;
}

export interface ProxyInfo {
  config: ProxyConfig;
  active: { url: string; source: string } | null;
  platform: string;
}

export type SearchType = 'music' | 'album' | 'artist' | 'sheet' | 'lyric';
export type QualityKey = 'low' | 'standard' | 'high' | 'super';

export interface SearchResult {
  isEnd: boolean;
  data: MusicItem[];
}

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

export interface LyricData {
  rawLrc: string;
  translation: string;
  lines: LyricLine[];
}

export interface PlaylistItem extends MusicItem {
  $$addedAt?: number;
}
