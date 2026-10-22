export function formatTime(seconds?: number): string {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatCount(n?: number): string {
  if (!n || n < 0) return '0';
  if (n < 10000) return String(n);
  if (n < 100000000) return (n / 10000).toFixed(1) + '万';
  return (n / 100000000).toFixed(1) + '亿';
}

export function trackKey(track: { platform?: string; id?: string }): string {
  return `${track?.platform || ''}::${track?.id || ''}`;
}

export const QUALITY_LABELS: Record<string, string> = {
  low: '流畅',
  standard: '标准',
  high: '高清',
  super: '无损',
};

/** 从设定音质开始，依次回退到其它音质 */
export function qualityOrder(preferred: string): string[] {
  const all = ['super', 'high', 'standard', 'low'];
  const idx = all.indexOf(preferred);
  if (idx < 0) return all;
  return [...all.slice(idx), ...all.slice(0, idx)];
}
