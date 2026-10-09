import { ideLocator } from "./ide-locator.js";

/**
 * 跨平台系统调度与进程唤醒执行器
 */

/**
 * 启动指定 IDE 并打开工程目录
 * @param {Object} project 项目对象
 * @returns {Promise<boolean>} 是否成功拉起
 */
export async function launchProject(project) {
  if (!project || !project.path) {
    throw new Error("缺少有效的项目路径");
  }

  const ruck = window.ruck;
  const projectPath = project.path;
  const platform = getPlatform();

  console.log(`[Executor] 正在启动 IDE 打开工程:`, {
    name: project.name,
    ide: project.ideName,
    path: projectPath,
    platform
  });

  let launched = false;

  try {
    if (ruck?.shell) {
      if (platform === "darwin") {
        // macOS: open -a <AppName> <projectPath>
        const appName = project.macAppName || project.ideName || "IntelliJ IDEA";
        await ruck.shell.execute("open", ["-a", appName, projectPath]);
        launched = true;
      } else if (platform === "win32") {
        // Windows: 执行具体 IDE 可执行程序（优先脱离拉起，兼备 spawn 异步启动，杜绝 30s 超时与重试）
        const candidateExecutables = getWindowsExecutableCandidates(project);

        for (const exe of candidateExecutables) {
          try {
            console.log(`[Executor] 尝试执行可执行文件:`, exe);
            await launchGuiApplication(ruck.shell, exe, [projectPath], "win32");
            launched = true;
            break;
          } catch (execErr) {
            console.warn(`[Executor] 执行 ${exe} 失败:`, execErr.message);
          }
        }
      } else {
        // Linux: 执行常规可执行程序
        const candidateExecutables = project.executables || ["idea", "webstorm", "pycharm"];
        for (const exe of candidateExecutables) {
          try {
            console.log(`[Executor] 尝试执行可执行文件:`, exe);
            await launchGuiApplication(ruck.shell, exe, [projectPath], "linux");
            launched = true;
            break;
          } catch (e) {
            console.warn(`[Executor] 执行 ${exe} 失败:`, e.message);
          }
        }
      }
    } else {
      console.warn(`[Executor] 宿主未提供 ruck.shell，降级记录`);
    }

    // 只有成功拉起启动命令后，才主动隐藏/退出主窗口
    if (launched) {
      console.log(`[Executor] 启动命令已成功执行，主动隐藏主窗口`);
      await hideAndOutPlugin();
      return true;
    } else {
      console.warn(`[Executor] 未能成功拉起启动器，保持窗口以便排查`);
      showNotice(`未找到可用的 ${project.ideName || "IDE"} 启动器，请检查安装路径`);
      return false;
    }
  } catch (error) {
    console.error(`[Executor] 启动 IDE 发生异常:`, error);
    showNotice(`启动 ${project.ideName || "IDE"} 失败: ${error.message}`);
    return false;
  }
}

/**
 * 在文件资源管理器 / 访达中显示项目所在目录
 * @param {string} filePath 项目路径
 */
export async function showProjectInFolder(filePath) {
  if (!filePath) return;
  const ruck = window.ruck;

  try {
    if (ruck?.shell?.showInFolder) {
      await ruck.shell.showInFolder(filePath);
    } else if (ruck?.shell?.openPath) {
      await ruck.shell.openPath(filePath);
    } else if (ruck?.shell?.execute) {
      if (getPlatform() === "win32") {
        await ruck.shell.execute("explorer.exe", [`/select,${filePath.replace(/\//g, "\\")}`]);
      } else if (getPlatform() === "darwin") {
        await ruck.shell.execute("open", ["-R", filePath]);
      }
    }
  } catch (err) {
    console.error(`[Executor] 打开文件夹失败:`, err);
  }
}

/**
 * 复制项目路径到剪贴板
 * @param {string} text 路径文本
 */
export async function copyProjectPath(text) {
  if (!text) return false;
  const ruck = window.ruck;

  try {
    if (ruck?.clipboard?.writeText) {
      await ruck.clipboard.writeText(text);
      showNotice("项目路径已复制到剪贴板");
      return true;
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showNotice("项目路径已复制到剪贴板");
      return true;
    }
  } catch (err) {
    console.error(`[Executor] 复制路径失败:`, err);
  }
  return false;
}

/**
 * 跨平台桌面 GUI 应用拉起器
 * 核心原则：彻底脱离宿主生命周期与 I/O 管道，杜绝 30s 超时与父子进程绑定
 * @param {Object} shell ruck.shell
 * @param {string} program 程序路径或可执行文件名
 * @param {string[]} args 启动参数（如项目路径）
 * @param {string} platform 当前操作系统平台
 */
async function launchGuiApplication(shell, program, args = [], platform = "win32") {
  if (!shell) {
    throw new Error("当前环境未提供有效的 shell 执行器");
  }

  // 1. Windows 专有优化：优先利用系统脱离命令 (cmd.exe /c start) 唤醒
  // start 命令可在 0.1 秒内返回 exitCode 0，同时将 GUI 进程完全交由 Windows 系统内核托管，绝无超时强杀
  if (platform === "win32") {
    try {
      console.log(`[Executor] 优先尝试通过 cmd.exe start 脱离拉起:`, program);
      await shell.execute("cmd.exe", ["/c", "start", "", program, ...args]);
      return true;
    } catch (cmdErr) {
      console.warn(`[Executor] cmd.exe 脱离拉起异常，尝试备用链路:`, cmdErr.message);
    }
  }

  // 2. 跨平台非阻塞通道：优先使用 ruck.shell.spawn
  if (typeof shell.spawn === "function") {
    console.log(`[Executor] 使用 ruck.shell.spawn 异步非阻塞拉起:`, program);
    await shell.spawn(program, args);
    return true;
  }

  // 3. 通用 execute 兜底
  if (typeof shell.execute === "function") {
    console.log(`[Executor] 使用 ruck.shell.execute 兜底拉起:`, program);
    await shell.execute(program, args);
    return true;
  }

  throw new Error("未能找到可用的进程启动接口");
}

/**
 * 获取 Windows 下的启动器候选列表
 * @param {Object} project
 * @returns {string[]}
 */
function getWindowsExecutableCandidates(project) {
  const candidates = [];

  // 1. 如果 project.launchExecutable 存在且有效，优先尝试
  if (project.launchExecutable) {
    candidates.push(project.launchExecutable);
  }

  // 2. 补充 Locator 探测到的最新绝对路径（防止缓存路径因版本更新失效）
  const appInfo = ideLocator.findAppForProject(project);
  if (appInfo && appInfo.exePath && !candidates.includes(appInfo.exePath)) {
    candidates.push(appInfo.exePath);
  }

  // 3. 如果 project.binFolder 存在，提取其中的 exe
  if (project.binFolder && typeof project.binFolder === "string") {
    const cleanBin = project.binFolder.replace(/^\$APPLICATION_HOME_DIR\$/, "").replace(/^[\\/]+/, "");
    const defaultExes = project.executables || ["idea64.exe"];
    for (const exeName of defaultExes) {
      if (!candidates.includes(exeName)) {
        candidates.push(exeName);
      }
    }
  }

  // 4. 从预设注册表中获取候选可执行文件名
  if (Array.isArray(project.executables)) {
    for (const exe of project.executables) {
      if (!candidates.includes(exe)) {
        candidates.push(exe);
      }
    }
  }

  // 5. 默认保底
  if (!candidates.includes("idea64.exe")) {
    candidates.push("idea64.exe");
  }

  return candidates;
}

/**
 * 获取当前平台 (优先根据家目录路径特征精准推断，结合 navigator 与环境变量)
 * @param {string} [homeDir] 可选家目录
 * @returns {"win32"|"darwin"|"linux"}
 */
export function getPlatform(homeDir = "") {
  // 1. 根据家目录格式推断（盘符 C:/ 绝对为 Windows，/Users/ 为 macOS，/home/ 为 Linux）
  if (homeDir && typeof homeDir === "string") {
    if (/^[a-zA-Z]:[\\/]/.test(homeDir)) return "win32";
    if (homeDir.startsWith("/Users/")) return "darwin";
    if (homeDir.startsWith("/home/")) return "linux";
  }

  // 2. 浏览器环境变量
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    const pf = navigator.platform || "";
    if (/win/i.test(pf) || /windows/i.test(ua)) return "win32";
    if (/mac/i.test(pf) || /macintosh|mac os/i.test(ua)) return "darwin";
    if (/linux/i.test(pf) || /linux/i.test(ua)) return "linux";
  }

  // 3. Node/宿主环境
  if (typeof process !== "undefined" && process.platform) {
    return process.platform;
  }

  return "win32";
}

/**
 * 隐藏并退出插件
 */
export async function hideAndOutPlugin() {
  try {
    if (window.ruck?.window?.hideMainWindow) {
      await window.ruck.window.hideMainWindow();
    } else if (window.ruck?.hideMainWindow) {
      await window.ruck.hideMainWindow();
    } else if (window.utools?.hideMainWindow) {
      window.utools.hideMainWindow();
    } else if (window.ztools?.hideMainWindow) {
      window.ztools.hideMainWindow();
    }

    if (window.ruck?.window?.outPlugin) {
      await window.ruck.window.outPlugin();
    } else if (window.utools?.outPlugin) {
      window.utools.outPlugin();
    } else if (window.ztools?.outPlugin) {
      window.ztools.outPlugin();
    }
  } catch (e) {
    console.warn("[Executor] 隐藏或退出插件窗口异常:", e);
  }
}

/**
 * 发送系统通知或气泡
 * @param {string} msg
 */
export function showNotice(msg) {
  try {
    if (window.ruck?.notification?.info) {
      window.ruck.notification.info(msg);
    } else if (window.ztools?.showNotification) {
      window.ztools.showNotification(msg);
    }
  } catch (e) {
    // ignore
  }
}
