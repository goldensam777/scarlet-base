# Scarlet Base - Windows PowerShell Installer 🤖
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         Scarlet Base - Assistant d'Installation 🤖       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Ce script va préparer le projet sur votre machine :"
Write-Host "1. Vérification des outils requis (git, node, npm)"
Write-Host "2. Vérification et clonage éventuel du projet"
Write-Host "3. Installation des dépendances npm"
Write-Host "4. Lancement optionnel de VS Code et de l'application"
Write-Host ""

# ÉTAPE 1 — Vérifications
Write-Host "→ Étape 1 : Vérification des prérequis..." -ForegroundColor Cyan

function Check-Tool ($Name, $Url) {
    $path = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $path) {
        Write-Host "❌ $Name n'est pas installé." -ForegroundColor Red
        Write-Host "→ Veuillez installer $Name ($Url) puis relancer ce script."
        Exit 1
    } else {
        Write-Host "  ✓ $Name trouvé" -ForegroundColor Green
    }
}

Check-Tool "git" "https://git-scm.com"
Check-Tool "node" "https://nodejs.org"
Check-Tool "npm" "https://nodejs.org"

# ÉTAPE 2 — Vérification et clonage éventuel du projet
Write-Host ""
Write-Host "→ Étape 2 : Vérification du dépôt..." -ForegroundColor Cyan

$isRepo = $false
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($null -ne $pkg -and $pkg.name -eq "scarlet-base") {
        $isRepo = $true
    }
}

if (-not $isRepo) {
    Write-Host "Dépôt Scarlet Base non détecté dans le dossier actuel."
    Write-Host "Clonage du projet dans le sous-dossier './scarlet-base'..."
    git clone https://github.com/goldensam777/scarlet-base.git
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Échec du clonage du projet." -ForegroundColor Red
        Exit 1
    }
    Set-Location "scarlet-base"
} else {
    Write-Host "  ✓ Projet déjà présent localement." -ForegroundColor Green
    if (Test-Path ".git") {
        Write-Host "Recherche de nouvelles versions..."
        git fetch --quiet 2>$null
        if ($LASTEXITCODE -eq 0) {
            $LOCAL = (git rev-parse HEAD)
            $REMOTE = (git rev-parse @{u} 2>$null)
            if ($null -eq $REMOTE) { $REMOTE = $LOCAL }

            if ($LOCAL -eq $REMOTE) {
                Write-Host "  ✓ Projet déjà à jour." -ForegroundColor Green
            } else {
                Write-Host "  ⚠ Une mise à jour est disponible sur le dépôt distant." -ForegroundColor Yellow
                $choice = Read-Host "Voulez-vous télécharger et installer la dernière mise à jour ? (O/N)"
                if ($choice -match '^[OoYy]') {
                    Write-Host "Mise à jour du projet..."
                    git pull --ff-only
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "  ✓ Projet mis à jour avec succès." -ForegroundColor Green
                    } else {
                        Write-Host "  ❌ Échec de la mise à jour automatique. On continue en l'état." -ForegroundColor Red
                    }
                } else {
                    Write-Host "Mise à jour ignorée."
                }
            }
        } else {
            Write-Host "  ⚠ Impossible de contacter le dépôt distant (fetch échoué)." -ForegroundColor Yellow
        }
    }
}

# ÉTAPE 3 — npm install
Write-Host ""
Write-Host "→ Étape 3 : Installation des dépendances npm..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de l'installation des dépendances npm." -ForegroundColor Red
    Exit 1
}
Write-Host "  ✓ Dépendances installées avec succès." -ForegroundColor Green

# ÉTAPE 4 — Ouverture VS Code
Write-Host ""
Write-Host "→ Étape 4 : Lancement et IDE..." -ForegroundColor Cyan
$codePath = Get-Command "code" -ErrorAction SilentlyContinue
if ($null -ne $codePath) {
    $choiceCode = Read-Host "Voulez-vous ouvrir le projet dans VS Code ? (O/N)"
    if ($choiceCode -match '^[OoYy]') {
        Write-Host "Ouverture de VS Code..."
        code .
    }
} else {
    Write-Host "  ⚠ VS Code n'a pas été détecté dans votre variable d'environnement PATH." -ForegroundColor Yellow
}

# ÉTAPE 5 — Lancement de l'application
Write-Host ""
$choiceApp = Read-Host "Voulez-vous lancer l'application en mode développement maintenant ? (O/N)"
if ($choiceApp -match '^[OoYy]') {
    Write-Host "Lancement de Scarlet Base..." -ForegroundColor Green
    npm run dev
} else {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "✔ Installation terminée avec succès !" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Pour lancer le projet plus tard :"
    Write-Host "  npm run dev" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Pour compiler pour la production :"
    Write-Host "  npm run build" -ForegroundColor Blue
    Write-Host "==========================================================" -ForegroundColor Green
}
