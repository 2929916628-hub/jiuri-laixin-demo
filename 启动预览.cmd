@echo off
title 旧日来信 · 交互 Demo
set "ROOT=%~dp0.."
set "URL=http://127.0.0.1:8125/11_%%E4%%BA%%A4%%E4%%BA%%92Demo_App/"
echo.
echo   旧日来信 · 记忆空间 交互 Demo
echo   ------------------------------------
netstat -ano | findstr /R /C:":8125 .*LISTENING" >nul
if not errorlevel 1 (
  rem 端口被占：如果占着的就是本 Demo 的服务，直接打开浏览器就行
  curl -sf -o nul -m 3 http://127.0.0.1:8125/__lan
  if not errorlevel 1 (
    echo   Demo 服务已经在运行了，直接打开浏览器。
    echo   （要关掉它：找到另一个黑色服务窗口关掉，或在任务管理器里结束 python.exe）
    start "" "%URL%"
    timeout /t 4 >nul
    exit /b 0
  )
  echo   8125 端口被别的程序占用了。
  echo   请在任务管理器里结束占用的程序（多半是 python.exe），然后再双击本文件。
  echo.
  pause
  exit /b 1
)
echo   本机打开：http://127.0.0.1:8125/11_交互Demo_App/
echo   手机扫码：看网页左侧的二维码（下面也会列出手机地址）
echo   关掉这个窗口即停止服务
echo.
start "" "%URL%"
python "%~dp0_serve.py" 8125 "%ROOT%"
if errorlevel 1 (
  echo.
  echo   启动失败：没有找到 Python，或 8125 端口被占用。
  pause
)