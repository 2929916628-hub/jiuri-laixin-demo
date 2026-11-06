#!/bin/bash
# 旧日来信 · Demo 本地服务（Mac / Linux 用；Windows 用 启动预览.cmd）
# 用法：在终端里运行  bash 启动预览.command
cd "$(dirname "$0")" || exit 1
ROOT="$(cd .. && pwd)"
URL="http://127.0.0.1:8125/11_%E4%BA%A4%E4%BA%92Demo_App/"
echo
echo "  旧日来信 · 记忆空间 交互 Demo"
echo "  ------------------------------------"
if curl -sf -o /dev/null -m 3 "http://127.0.0.1:8125/__lan"; then
  echo "  Demo 服务已经在运行了，直接打开浏览器。"
  open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null
  exit 0
fi
PY=python3; command -v python3 >/dev/null || PY=python
echo "  本机打开：http://127.0.0.1:8125/11_交互Demo_App/"
echo "  手机扫码：看网页左侧的二维码"
echo "  关掉这个窗口（或按 Ctrl+C）即停止服务"
echo
( sleep 1.5; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null ) &
"$PY" "_serve.py" 8125 "$ROOT"
