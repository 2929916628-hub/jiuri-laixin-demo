@echo off
title 旧日来信 · 配置数字分身 AI
echo.
echo   旧日来信 · 配置数字分身用的大模型
echo   ------------------------------------
echo   马上会弹出一个小窗口：去 DeepSeek 网页复制 key，回到窗口点「粘贴」，再点「保存」。
echo   DeepSeek（推荐）：https://platform.deepseek.com  →  API keys
echo   智谱（备选，免费）：https://bigmodel.cn  →  API Keys
echo   key 只存在这台电脑的用户目录里，不会进 Demo 文件夹，也不会被打包。
echo   不配置也能演示：用示例人设「阿哲」和本地规则回话。
python "%~dp0_ai_setup.py"