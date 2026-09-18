import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('CodeCalc Preload onMainPush 即时计算与回车粘贴契约验证', async (t) => {
  let registeredPushHandler = null;
  let registeredSelectHandler = null;

  const mockRuck = {
    clipboard: {
      written: null,
      pasted: null,
      writeText(t) {
        this.written = t;
      },
      paste(shortcut) {
        this.pasted = shortcut;
      }
    },
    window: {
      hidden: false,
      hideMainWindow(isRestore) {
        this.hidden = true;
      }
    },
    onMainPush(pushCb, selectCb) {
      registeredPushHandler = pushCb;
      registeredSelectHandler = selectCb;
    }
  };

  global.window = {
    ruck: mockRuck
  };

  // 加载编译后的 dist/preload.js
  require('../dist/preload.js');

  assert.ok(registeredPushHandler, 'preload 必须在启动加载时完成 onMainPush 回调注册');
  assert.ok(registeredSelectHandler, 'preload 必须注册 onSelect 选中处理函数');

  await t.test('输入 1+1 应返回实时计算结果 2', () => {
    const results = registeredPushHandler({ code: 'quickcalc', type: 'regex', payload: '1+1' });
    assert.ok(Array.isArray(results) && results.length > 0, '结果必须为非空数组');
    assert.equal(results[0].text, '2');
    assert.equal(results[0].title, '1+1 = 2 (回车直接粘贴)');
  });

  await t.test('兼容对象结构入参 { searchWord: "100*2.5" }', () => {
    const results = registeredPushHandler({
      code: 'quickcalc',
      type: 'regex',
      payload: { searchWord: '100*2.5' }
    });
    assert.ok(Array.isArray(results) && results.length > 0);
    assert.equal(results[0].text, '250');
  });

  await t.test('兼容末尾等号算式 "1+1="', () => {
    const results = registeredPushHandler({
      code: 'quickcalc',
      type: 'regex',
      payload: '1+1='
    });
    assert.ok(Array.isArray(results) && results.length > 0);
    assert.equal(results[0].text, '2');
  });

  await t.test('不合法或未完成的算式应静默返回空数组 []', () => {
    const results = registeredPushHandler({
      code: 'quickcalc',
      type: 'regex',
      payload: '1++'
    });
    assert.deepEqual(results, []);
  });

  await t.test('回车选中时执行自动复制并粘贴，返回 false 保持静默关闭', () => {
    const results = registeredPushHandler({ code: 'quickcalc', type: 'regex', payload: '1+1' });
    const selectReturn = registeredSelectHandler({ option: results[0] });

    assert.equal(selectReturn, false, 'onSelect 必须返回 false 以免展开大窗口');
    assert.equal(mockRuck.clipboard.written, '2', '结果必须写入剪贴板');
    assert.equal(mockRuck.window.hidden, true, '必须隐藏主窗口');
    assert.equal(mockRuck.clipboard.pasted, 'ctrl_v', '必须调用原生粘贴快捷键');
  });
});
