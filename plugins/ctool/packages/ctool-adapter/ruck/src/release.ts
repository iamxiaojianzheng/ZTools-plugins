import { copyCoreDist, release, replaceFileContent, version, getAdditionData, getPath } from "ctool-adapter-base";
import { tools, ToolInterface, FeatureInterface, AllLocaleStructure } from "ctool-config";
import { join } from "path";
import { cpSync, mkdirSync, rmSync, existsSync, copyFileSync } from "fs";

const tempPath = join(__dirname, "../_temp");
rmSync(tempPath, { recursive: true, force: true });
mkdirSync(tempPath, { recursive: true });

// 1. 复制前端构建产物 (tool.html, index.html, assets...)
copyCoreDist(tempPath);

// 2. 复制 Ruck 资源模板 (plugin.json 等)
cpSync(join(__dirname, "../resources"), tempPath, { recursive: true });

// 3. 复制图标资源为 logo.png
const candidateIcons = [
    getPath("packages/ctool-core/public/icon/icon_1024.png"),
    getPath("packages/ctool-core/public/icon/icon_utools.png"),
    getPath("images/v2.0.0.png")
];
let logoCopied = false;
for (const iconPath of candidateIcons) {
    if (existsSync(iconPath)) {
        copyFileSync(iconPath, join(tempPath, "logo.png"));
        // 同步一份到 ctool 插件根目录
        copyFileSync(iconPath, getPath("logo.png"));
        logoCopied = true;
        break;
    }
}
if (!logoCopied) {
    console.warn("未找到候选图标文件，请手动补齐 logo.png");
}

// 4. 提取多语言与关键词，自动构建 features
const addition = getAdditionData();
const i18n: AllLocaleStructure = addition["i18n"];

const getToolTitle = (tool: ToolInterface) => {
    return i18n.detail.zh_CN[`tool_${tool.name}`]?.message || tool.name;
};
const getToolFeatureTitle = (feature: FeatureInterface) => {
    return i18n.detail.zh_CN[`tool_${feature.tool.name}_${feature.name}`]?.message || feature.name;
};

type RuckFeature = {
    code: string;
    explain: string;
    cmds: string[];
};

const ruckFeatures: RuckFeature[] = [
    {
        code: "ctool",
        explain: "Ctool - 程序开发常用工具箱",
        cmds: ["ctool", "开发工具", "工具箱", "常用工具", "devtools"]
    }
];

tools.forEach(tool => {
    tool.features.forEach(feature => {
        const code = `ctool-${tool.name}-${feature.name}`;
        const explain = `${tool.isSimple() ? "" : getToolTitle(tool) + " - "}${getToolFeatureTitle(feature)}`;
        const toolTitle = getToolTitle(tool);
        const featureTitle = getToolFeatureTitle(feature);
        const rawKeywords = i18n.detail.zh_CN[`tool_${tool.name}_${feature.name}_keywords`]?.message || "";
        const extraKeywords = rawKeywords ? rawKeywords.split(",") : [];

        const cmds = Array.from(new Set([
            tool.name,
            feature.name,
            toolTitle,
            featureTitle,
            tool.isSimple() ? `ctool-${tool.name}` : `ctool-${tool.name}-${feature.name}`,
            `${toolTitle}${featureTitle}`,
            ...extraKeywords
        ].map(k => k.trim().toLowerCase()).filter(k => k.length > 0)));

        if (cmds.length > 0) {
            ruckFeatures.push({ code, explain, cmds });
        }
    });
});

(async () => {
    const v = version();
    const pluginJsonPath = join(tempPath, "plugin.json");

    // 写入版本号与 features
    replaceFileContent(pluginJsonPath, "##version##", v);
    replaceFileContent(pluginJsonPath, '"##features##"', JSON.stringify(ruckFeatures, null, 2));

    // 同步一份 plugin.json 到插件根目录，供 publish-ruck-plugin 检测
    copyFileSync(pluginJsonPath, getPath("plugin.json"));

    // 5. 将完整产物同步输出到 plugins/ctool/dist，无缝对接 Ruck 发布流水线
    const rootDist = getPath("dist");
    rmSync(rootDist, { recursive: true, force: true });
    mkdirSync(rootDist, { recursive: true });
    cpSync(tempPath, rootDist, { recursive: true });

    // 6. 打包发布 zip 归档
    const releaseZip = await release(tempPath, "ruck");
    console.info(`✅ [Ruck] 打包归档成功: ${releaseZip}`);
    console.info(`✅ [Ruck] 插件产物已同步部署至: ${rootDist}`);

    // 清理临时目录
    rmSync(tempPath, { recursive: true, force: true });
})();
