import {
    PlatformRuntime,
    StorageInterface,
    toolExists,
    getTool,
    Initializer,
} from "ctool-config";
import storageRuck from "./storage";

export const runtime = new (class implements PlatformRuntime {
    name = "ruck";

    is() {
        if (typeof window === "undefined") {
            return false;
        }
        return !!(window as any).ruck || navigator.userAgent.includes("Ruck");
    }

    openUrl(url: string) {
        if (typeof window !== "undefined") {
            if ((window as any).ruck?.shell?.open) {
                return (window as any).ruck.shell.open(url);
            }
            if ((window as any).ruck?.openExternal) {
                return (window as any).ruck.openExternal(url);
            }
            return window.open(url);
        }
    }

    storage(): StorageInterface {
        return storageRuck;
    }

    getLocale() {
        return "zh_CN";
    }

    initialize(initializer: Initializer) {
        if (typeof window === "undefined") {
            return;
        }

        const handleEnter = (action: { code?: string; type?: string; payload?: any }) => {
            if (!action || !action.code) {
                return;
            }
            const { code, payload = "" } = action;

            // Ruck 激活主窗口通知
            try {
                (window as any).ruck?.window?.showMainWindow?.();
            } catch {}

            // 若不是 ctool 子功能，或为 default / ctool 主入口，保持在当前页面或首页
            if (!code.includes("ctool-") || code === "ctool" || code === "default") {
                return;
            }

            const [, _tool, _feature] = code.split("-");
            if (!toolExists(_tool)) {
                return;
            }

            const tool = getTool(_tool);
            if (!tool.existFeature(_feature)) {
                return;
            }
            const feature = tool.getFeature(_feature);

            const query: Record<string, string> = {};
            // 输入框数据写入临时存储（文本或正则匹配内容）
            if (payload !== undefined && payload !== null && payload !== "") {
                const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
                initializer.storage().setNoVersion("_temp_input_storage", payloadStr, 10);
                // 添加随机数防止页面不刷新
                query["_t"] = `${Math.random()}`;
            }

            initializer.push(feature.getRouter(), query);
        };

        // 1. 注册 Ruck 宿主进入事件
        if ((window as any).ruck?.onPluginEnter) {
            (window as any).ruck.onPluginEnter(handleEnter);
        }

        // 2. 兼容 ztools 进入事件（若处于桥接运行环境）
        if ((window as any).ztools?.onPluginEnter) {
            (window as any).ztools.onPluginEnter(handleEnter);
        }

        // 3. 处理冷启动可能已传入的初始 action
        try {
            const launchAction = (window as any).ruck?.getLaunchAction?.()
                || (window as any).ztools?.getLaunchAction?.();
            if (launchAction && launchAction.code && launchAction.code !== "default" && launchAction.code !== "ctool") {
                handleEnter(launchAction);
            }
        } catch {}
    }
})();
