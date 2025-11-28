:: FILE: start-3273.bat  (root project)
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title next-server (v15.5.4)

:: ===== Konfigurasi =====
set "PORT=3273"
set "HOST=0.0.0.0"
set "NEXT_BASEPATH=/monitoring"

pushd "%~dp0" >nul

where node >nul 2>&1 || (
  echo [ERROR] Node.js tidak ditemukan di PATH.
  pause
  popd
  exit /b 1
)

if not exist "scripts\pretty-start.mjs" (
  echo [ERROR] scripts\pretty-start.mjs tidak ditemukan.
  pause
  popd
  exit /b 1
)

set "PORT=%PORT%"
set "HOST=%HOST%"
set "NEXT_BASEPATH=%NEXT_BASEPATH%"

echo.
:: PERHATIKAN: tidak ada kata "start" di belakang "--"
call node scripts\pretty-start.mjs -- -p %PORT% -H %HOST%
set "EC=%ERRORLEVEL%"

echo.
echo [EXIT] Kode keluar: %EC%
echo Tekan tombol apa saja untuk menutup jendela ini...
pause >nul

popd
endlocal
