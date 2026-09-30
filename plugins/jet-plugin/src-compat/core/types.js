/**
 * @typedef {Object} JetBrainsProduct
 * @property {string} code 产品代号，如 "IU", "WS", "PC"
 * @property {string} name 产品名称，如 "IntelliJ IDEA", "WebStorm"
 * @property {RegExp} dirPattern 目录名匹配正则，如 /^IntelliJIdea/i
 * @property {string[]} defaultExecutables 默认启动器文件名候选
 * @property {string} [iconSvg] 内置高清 SVG 图标
 */

/**
 * @typedef {Object} RecentProject
 * @property {string} id 唯一标识
 * @property {string} name 项目名称
 * @property {string} path 项目绝对路径
 * @property {string} ideCode 关联的 IDE 代号
 * @property {string} ideName 关联的 IDE 名称
 * @property {string} [ideIcon] IDE 图标 (SVG Data URL 或内置)
 * @property {number} openTimestamp 最近打开时间戳
 * @property {number} [activationTimestamp] 激活时间戳
 * @property {string} [binFolder] 可执行文件所在目录
 * @property {string} [launchExecutable] 解析出的可执行文件绝对路径或命令
 */

export const EMPTY_RESULT = [];
