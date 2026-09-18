import {
    isDarkColors,
    isZtoolsEnv,
    onPluginEnter,
    onPluginOut,
    onThemeChange,
    outPlugin,
    pasteText
} from './host.js';

const Calculator = window.CodeCalcCore?.Calculator || null;
let hasHandledPluginOut = false;

function isBase64(str) {
    str = str.trim();
    return /^(?=(?:.*[A-Za-z]){3,})(?:[A-Za-z0-9+\/]{4}){3,}(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(str);
}

function handleRegexInput(code, payload) {
    let expr = String(payload || '').trim();

    if (code === 'quickcalc') {
        if (isBase64(expr)) {
            expr = 'str(' + expr + ').unbase64';
        } else if (expr.endsWith('=')) {
            expr = expr.substring(0, expr.length - 1);
        }
    } else if (code === 'timestamp') {
        if (!expr.startsWith('@')) {
            expr = '@' + expr;
        }
        expr = expr.replace(/\//g, '-');
    }

    return expr;
}

function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function shouldPersistOnPluginOut(processExited) {
    return processExited === true;
}

function handlePluginOut(processExited) {
    if (hasHandledPluginOut) return;

    const historyToggle = document.getElementById('historyToggle');
    const keepHistory = historyToggle ? historyToggle.checked : true;

    if (!keepHistory) {
        hasHandledPluginOut = true;
        clearAll();
        return;
    }

    if (shouldPersistOnPluginOut(processExited)) {
        hasHandledPluginOut = true;
        clearAll();
    }
}

setTheme(isDarkColors());

onThemeChange((matches) => {
    setTheme(matches);
});

// Escape 全局退出治理: 仅在非编辑状态、输入框为空且未打开任何弹窗时触发 outPlugin
function isAnyModalVisible() {
    return Boolean(
        window.settings?.isPanelVisible ||
        window.shortcuts?.isPanelVisible ||
        window.snapshot?.isPanelVisible ||
        window.customFunctions?.isPanelVisible
    );
}

function handleGlobalEscape(event) {
    if (event.key !== 'Escape' && event.code !== 'Escape') return;

    // 若有模态面板开启，由面板自身的 Escape 事件关闭
    if (isAnyModalVisible()) return;

    // 若当前输入框中有非空内容，不直接关闭，方便用户清空或编辑
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        if (activeEl.value && activeEl.value.trim() !== '') {
            return;
        }
    }

    event.preventDefault();
    event.stopPropagation();
    outPlugin();
}

window.addEventListener('keydown', handleGlobalEscape, true);
document.addEventListener('keydown', handleGlobalEscape, true);

if (isZtoolsEnv) {
    onPluginEnter((action = {}) => {
        const code = action.code || '';
        const type = action.type || 'text';
        const payload = action.payload || '';

        const inputs = document.querySelectorAll('.input');
        const lastInput = inputs[inputs.length - 1];

        if (type === 'regex') {
            const expr = handleRegexInput(code, payload);

            if (lastInput && lastInput.value.trim() !== '') {
                addNewLine();
                const newInputs = document.querySelectorAll('.input');
                const newLastInput = newInputs[newInputs.length - 1];
                if (newLastInput) {
                    newLastInput.value = expr;
                    newLastInput.dispatchEvent(new Event('input'));
                }
            } else if (lastInput) {
                lastInput.value = expr;
                lastInput.dispatchEvent(new Event('input'));
            }
        } else if (lastInput) {
            lastInput.focus();
        }
    });

    onPluginOut((processExited) => {
        handlePluginOut(processExited);
    });
}
