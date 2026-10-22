/// <reference types="vite/client" />
/// <reference types="@ztools-center/ztools-api-types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

/** preload 通过 src-ztools/preload/services.js 注入的能力 */
interface WmServices {
  version: string
  ready(): Promise<{ version: string; mediaPort: number; network?: any }>
  plugins: Record<string, (...args: any[]) => Promise<any>>
  music: Record<string, (...args: any[]) => Promise<any>>
  network: {
    get(): any
    set(config: any): any
    detect(): any
    test(url?: string): Promise<any>
    mirrorList(url: string): string[]
  }
  media: {
    getStreamUrl(url: string, headers?: Record<string, string>): Promise<string | null>
    getPort(): Promise<number>
    download(
      url: string,
      headers: Record<string, string> | undefined,
      filename: string,
      onProgress?: (ratio: number, received: number, total: number) => void
    ): Promise<{ canceled: boolean; path?: string; size?: number }>
    setLyricsState(state: any): boolean
    getLyricsSync(): Promise<{ port: number; token: string }>
  }
  storage: {
    get(key: string): any
    set(key: string, value: any): boolean
    remove(key: string): boolean
    all(): Record<string, any>
    kind(): 'ztools' | 'local' | 'memory'
  }
}

declare global {
  interface Window {
    services?: WmServices
  }
}

export {}
