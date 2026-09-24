import { StorageInterface, StorageDataStructure, StorageDataStructureInterface } from "ctool-config";

const PREFIX = "ctool.";

class RuckStorage implements StorageInterface {
    get<T>(key: string): StorageDataStructure<T> {
        try {
            if (typeof window === "undefined" || !window.localStorage) {
                return null;
            }
            const raw = window.localStorage.getItem(`${PREFIX}${key}`);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    set<T>(key: string, value: StorageDataStructureInterface<T>): void {
        try {
            if (typeof window === "undefined" || !window.localStorage) {
                return;
            }
            window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
        } catch (e) {
            console.error("[RuckStorage] setItem error:", e);
        }
    }

    remove(key: string): void {
        try {
            if (typeof window === "undefined" || !window.localStorage) {
                return;
            }
            window.localStorage.removeItem(`${PREFIX}${key}`);
        } catch (e) {
            console.error("[RuckStorage] removeItem error:", e);
        }
    }

    clear(): void {
        try {
            for (const key of this.getAllKey()) {
                this.remove(key);
            }
        } catch (e) {
            console.error("[RuckStorage] clear error:", e);
        }
    }

    getAllKey(): string[] {
        try {
            if (typeof window === "undefined" || !window.localStorage) {
                return [];
            }
            const keys: string[] = [];
            for (let i = 0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i);
                if (k && k.startsWith(PREFIX)) {
                    keys.push(k.slice(PREFIX.length));
                }
            }
            return keys;
        } catch {
            return [];
        }
    }
}

export default new RuckStorage();
