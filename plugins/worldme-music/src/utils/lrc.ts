import type { LyricLine } from '@/types';

const TIME_RE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

function toSeconds(m: string, s: string, ms?: string): number {
  let base = parseInt(m, 10) * 60 + parseInt(s, 10);
  if (ms) {
    const frac = parseFloat('0.' + ms);
    base += frac;
  }
  return Math.round(base * 1000) / 1000;
}

interface RawLine {
  time: number;
  text: string;
}

function parseRaw(raw: string): RawLine[] {
  const out: RawLine[] = [];
  if (!raw) return out;
  raw.split(/\r?\n/).forEach((line) => {
    TIME_RE.lastIndex = 0;
    const times: number[] = [];
    let m: RegExpExecArray | null;
    let lastIndex = 0;
    while ((m = TIME_RE.exec(line)) !== null) {
      times.push(toSeconds(m[1], m[2], m[3]));
      lastIndex = TIME_RE.lastIndex;
    }
    if (!times.length) return;
    const text = line.slice(lastIndex).trim();
    times.forEach((t) => out.push({ time: t, text }));
  });
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** 合并原文与翻译，生成按时间排序的歌词行 */
export function buildLyrics(rawLrc: string, translation: string): LyricLine[] {
  const main = parseRaw(rawLrc);
  const trans = parseRaw(translation);
  const map = new Map<number, LyricLine>();

  main.forEach((l) => {
    const key = Math.round(l.time * 100) / 100;
    if (!map.has(key)) map.set(key, { time: l.time, text: l.text });
    else if (!map.get(key)!.text) map.get(key)!.text = l.text;
  });
  trans.forEach((l) => {
    const key = Math.round(l.time * 100) / 100;
    if (map.has(key)) {
      map.get(key)!.translation = l.text;
    } else {
      map.set(key, { time: l.time, text: '', translation: l.text });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

/** 根据当前播放秒数找到高亮行索引 */
export function activeLineIndex(lines: LyricLine[], current: number): number {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= current + 0.15) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
