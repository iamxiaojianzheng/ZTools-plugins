/**
 * MusicFree 内置 npm 包的白名单 require
 * 与 MusicFree 桌面端 packages 映射保持一致，保证第三方音源插件可直接运行。
 */
const net = require('./net');
const { pluginStorage, reactNativeCookies } = require('./polyfills');

let cheerio;
let CryptoJs;
let dayjs;
let bigInt;
let qs;
let he;
let webdav;

try {
  cheerio = require('cheerio');
} catch (e) {
  cheerio = undefined;
}
try {
  CryptoJs = require('crypto-js');
} catch (e) {
  CryptoJs = undefined;
}
try {
  dayjs = require('dayjs');
} catch (e) {
  dayjs = undefined;
}
try {
  bigInt = require('big-integer');
} catch (e) {
  bigInt = undefined;
}
try {
  qs = require('qs');
} catch (e) {
  qs = undefined;
}
try {
  he = require('he');
} catch (e) {
  he = undefined;
}
try {
  webdav = require('webdav');
} catch (e) {
  webdav = undefined;
}

const packages = {
  cheerio,
  'crypto-js': CryptoJs,
  axios: net.axios,
  dayjs,
  'big-integer': bigInt,
  qs,
  he,
  webdav,
  '@react-native-cookies/cookies': reactNativeCookies,
  'musicfree/storage': pluginStorage,
};

function _require(packageName) {
  const pkg = packages[packageName];
  if (pkg) {
    try {
      pkg.default = pkg;
    } catch (e) {
      /* ignore */
    }
    return pkg;
  }
  return null;
}

module.exports = _require;
