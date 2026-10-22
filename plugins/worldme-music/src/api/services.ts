/** window.services 访问封装（等待 preload 注入完成） */

let readyPromise: Promise<any> | null = null;

export function waitForServices(timeout = 8000): Promise<any> {
  if (window.services) return Promise.resolve(window.services);
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.services) {
        clearInterval(timer);
        resolve(window.services);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error('preload 服务未就绪'));
      }
    }, 50);
  });
  return readyPromise;
}

export function services(): any {
  if (!window.services) throw new Error('preload 服务未就绪');
  return window.services;
}

export function hasServices(): boolean {
  return !!window.services;
}
