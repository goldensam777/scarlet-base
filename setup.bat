@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Scarlet Base - Assistant d'Installation 🤖

echo ==========================================================
echo          Scarlet Base - Assistant d'Installation 🤖
echo ==========================================================
echo Ce script va preparer le projet sur votre machine :
echo 1. Verification des outils requis (git, node, npm)
echo 2. Recherche de mises a jour via git fetch
echo 3. Installation des dependances npm
echo 4. Lancement optionnel de l'application via start.bat
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

:: ÉTAPE 2 — Recherche de nouvelles versions via git fetch
echo.
echo → Etape 2 : Verification des mises a jour...
if exist ".git" (
    echo Recherche de nouvelles versions (git fetch)...
    call git fetch --quiet >nul 2>&1
    if errorlevel 0 (
        for /f "tokens=*" %%i in ('git rev-parse HEAD') do set LOCAL=%%i
        for /f "tokens=*" %%i in ('git rev-parse @{u} 2^>nul') do set REMOTE=%%i
        if not defined REMOTE set REMOTE=!LOCAL!

        if "!LOCAL!"=="!REMOTE!" (
            echo   [ok] Projet deja a jour.
        ) else (
            echo   [warning] Une mise a jour est disponible sur le depot distant.
            set /p "UPDATE_ASK=Voulez-vous telecharger et installer la derniere mise a jour ? (O/N) : "
            if /i "!UPDATE_ASK!"=="o" (
                echo Mise a jour du projet...
                call git pull --ff-only
                if errorlevel 1 (
                    echo   [warning] Echec de la mise a jour automatique.
                ) else (
                    echo   [ok] Projet mis a jour avec succes.
                )
            ) else (
                echo Mise a jour ignoree.
            )
        )
    ) else (
        echo   [warning] Impossible de contacter le depot distant (fetch echoue).
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

:: ÉTAPE 4 — Lancement de l'application
echo.
set /p "LAUNCH_APP=Voulez-vous lancer l'application en mode developpement maintenant ? (O/N) : "
if /i "!LAUNCH_APP!"=="o" (
    echo Lancement de Scarlet Base via start.bat...
    call start.bat
) else (
    echo ==========================================================
    echo [ok] Installation terminee avec succes !
    echo ==========================================================
    echo Pour lancer le projet plus tard :
    echo   start.bat
    echo.
    echo Pour compiler pour la production :
    echo   npm run build
    echo ==========================================================
    pause
)
