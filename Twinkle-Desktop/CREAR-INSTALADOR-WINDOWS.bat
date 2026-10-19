@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Crear instalador de Twinkle
where node >nul 2>nul || (echo Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar este archivo.& pause & exit /b 1)
echo Instalando dependencias y preparando el instalador de Windows...
call npm install
if errorlevel 1 (echo Fallo npm install.& pause & exit /b 1)
call npm run dist
if errorlevel 1 (echo No se pudo crear el instalador.& pause & exit /b 1)
echo.
echo Instalador creado en la carpeta dist.
pause
