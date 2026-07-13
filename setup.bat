@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Scarlet Base - Assistant d'Installation 🤖

echo ==========================================================
echo          Scarlet Base - Assistant d'Installation 🤖
echo ==========================================================
echo Ce script va preparer le projet sur votre machine :
echo 1. Verification des outils requis (git, node, npm)
echo 2. Mise a jour facultative du depot
echo 3. Installation des dependances npm
echo 4. Lancement optionnel de VS Code et de l'application
echo.

:: ÉTAPE 1 — Vérifications
echo → Etape 1 : Verification des prerequis...

for %%T in (git node npm) do (
    where %%T >nul 2>&1
    if errorlevel 1 (
        echo [erreur] %%T n'est pas installe.
        echo Veuillez installer %%T puis relancer ce script.
        pause
        exit /b 1
    ) else (
        echo   [ok] %%T trouve
    )
)

:: ÉTAPE 2 — Mise à jour Git si applicable
echo.
echo → Etape 2 : Verification des mises a jour...
if exist ".git" (
    echo Depot Git detecte. Tentative de pull...
    git pull --ff-only >nul 2>&1
    if errorlevel 1 (
        echo   [warning] Impossible de mettre a jour automatiquement (divergence).
        echo   On continue avec la version locale actuelle.
    ) else (
        echo   [ok] Projet a jour.
    )
) else (
    echo Aucun depot Git detecte au dossier courant, passage a la suite.
)

:: ÉTAPE 3 — npm install
echo.
echo → Etape 3 : Installation des dependances npm...
call npm install
if errorlevel 1 (
    echo [erreur] Echec de l'installation des dependances npm.
    pause
    exit /b 1
)
echo   [ok] Dependances installees avec succes.

:: ÉTAPE 4 — Ouverture VS Code
echo.
echo → Etape 4 : Lancement et IDE...
where code >nul 2>&1
if %errorlevel% equ 0 (
    set /p "OPEN_CODE=Voulez-vous ouvrir le projet dans VS Code ? (O/N) : "
    if /i "!OPEN_CODE!"=="o" (
        echo Ouverture de VS Code...
        code .
    )
) else (
    echo [warning] VS Code n'a pas ete detecte dans le PATH.
)

:: ÉTAPE 5 — Lancement de l'application
echo.
set /p "LAUNCH_APP=Voulez-vous lancer l'application en mode developpement maintenant ? (O/N) : "
if /i "!LAUNCH_APP!"=="o" (
    echo Lancement de Scarlet Base...
    call npm run dev
) else (
    echo ==========================================================
    echo [ok] Installation terminee avec succes !
    echo ==========================================================
    echo Pour lancer le projet plus tard :
    echo   npm run dev
    echo.
    echo Pour compiler pour la production :
    echo   npm run build
    echo ==========================================================
    pause
)
