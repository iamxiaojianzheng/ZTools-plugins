/**
 * window.ztools / window.utools 宿主接口兼容垫片
 */

import { hideAndOutPlugin, showNotice, copyProjectPath, getPlatform } from "./core/executor.js";

export function createZtoolsShim() {
  const ruck = window.ruck;

  return {
    isDev() {
      return false;
    },
    isMacOS() {
      return getPlatform() === "darwin";
    },
    isWindows() {
      return getPlatform() === "win32";
    },
    isLinux() {
      return getPlatform() === "linux";
    },
    getPath(name) {
      if (name === "home") {
        return "C:/Users/default";
      }
      if (name === "appData") {
        return "C:/Users/default/AppData/Roaming";
      }
      return "";
    },
    getFileIcon(path) {
      return "";
    },
    hideMainWindow() {
      hideAndOutPlugin();
    },
    outPlugin() {
      hideAndOutPlugin();
    },
    showNotification(msg) {
      showNotice(msg);
    },
    copyText(text) {
      copyProjectPath(text);
    },
    onPluginEnter(cb) {
      if (ruck?.onPluginEnter) {
        ruck.onPluginEnter(cb);
      }
    },
    onPluginOut(cb) {
      if (ruck?.onPluginOut) {
        ruck.onPluginOut(cb);
      }
    },
    dbStorage: {
      getItem(key) {
        try {
          const val = localStorage.getItem(`ztools_${key}`);
          return val ? JSON.parse(val) : null;
        } catch (e) {
          return null;
        }
      },
      setItem(key, value) {
        try {
          localStorage.setItem(`ztools_${key}`, JSON.stringify(value));
        } catch (e) {
          // ignore
        }
      },
      removeItem(key) {
        localStorage.removeItem(`ztools_${key}`);
      }
    }
  };
}
