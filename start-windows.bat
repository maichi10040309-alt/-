@echo off
cd /d %~dp0

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js がインストールされていません。
  echo https://nodejs.org/ からインストールしてから、もう一度このファイルをダブルクリックしてください。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 初回起動のため、必要なファイルをインストールしています。少々お待ちください...
  call npm install
  if errorlevel 1 (
    echo インストールに失敗しました。
    pause
    exit /b 1
  )
)

echo.
echo 販売管理ソフトを起動しています...
echo 終了するときは、このウィンドウを閉じてください。
echo.

start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173/"
call npm run dev
pause
