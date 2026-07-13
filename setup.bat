@echo off
title Scarlet Base - Installation du Projet
echo ==========================================================
echo          Scarlet Base - Installation du Projet
echo ==========================================================

:: 1. Vérification de Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERREUR : Node.js n'est pas installe sur votre systeme.
    echo Veuillez telecharger et installer Node.js [version LTS recommandee] depuis : https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set node_ver=%%i
echo [ok] Node.js detecte : %node_ver%

:: 2. Vérification de npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERREUR : npm n'est pas installe.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set npm_ver=%%i
echo [ok] npm detecte : %npm_ver%

:: 3. Installation des dépendances
echo.
echo Installation des dependances npm...
call npm install

:: 4. Message de réussite
echo.
echo ==========================================================
echo [ok] Installation terminee avec succes !
echo ==========================================================
echo Pour lancer le projet en mode developpement :
echo   npm run dev
echo.
echo Pour compiler le projet pour la production :
echo   npm run build
echo ==========================================================
pause
