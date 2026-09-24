#!/bin/bash

# 构建插件脚本
set -e  # 遇到错误立即退出

echo "开始构建插件..."

# 安装依赖
echo "1. 安装依赖..."
pnpm install

# 编译核心文件
echo "2. 编译核心文件..."
pnpm run build

# 编译插件
echo "3. 编译插件..."
pnpm --filter ctool-adapter-ruck run platform-release

# 检查产物
if [ -d "dist" ] && [ -f "dist/plugin.json" ]; then
    echo "✓ Ruck 插件构建产物已就绪在 dist 目录"
elif [ -f "_release/ctool_ruck.zip" ]; then
    rm -rf dist
    mkdir -p dist
    unzip -q _release/ctool_ruck.zip -d dist/
    echo "✓ 构建产物已解压到 dist 目录"
else
    echo "✗ 错误: 构建失败"
    exit 1
fi

echo "构建完成！"
