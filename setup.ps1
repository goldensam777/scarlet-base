$OutputEncoding = [System.Text.Encoding]::UTF8

# Détection de l'existence d'une session utilisateur interactive
$HAS_UI = [Environment]::UserInteractive


Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         Scarlet Base - Assistant d'Installation 🤖       " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Ce script va préparer le projet sur votre machine :"
Write-Host "1. Vérification des outils requis (git, node, npm)"
Write-Host "2. Vérification et clonage éventuel du projet"
Write-Host "3. Installation des dépendances npm"
Write-Host "4. Lancement optionnel de l'application via start.ps1"
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
            $REMOTE = (git rev-parse '@{u}' 2>$null)
            if ($null -eq $REMOTE) { $REMOTE = $LOCAL }

            if ($LOCAL -eq $REMOTE) {
                Write-Host "  ✓ Projet déjà à jour." -ForegroundColor Green
            } else {
                Write-Host "  ⚠ Une mise à jour est disponible sur le dépôt distant." -ForegroundColor Yellow
                if ($HAS_UI) {
                    $choice = Read-Host "Voulez-vous télécharger et installer la dernière mise à jour ? (O/N)"
                } else {
                    Write-Host "  [info] Environnement sans interface utilisateur interactive. Passage automatique."
                    $choice = "N"
                }
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

# ÉTAPE HORS-SÉRIE — Raccourci Bureau Windows
Write-Host ""
Write-Host "→ Étape supplémentaire : Création de l'icône et du raccourci Bureau..." -ForegroundColor Cyan
try {
    $currentDir = (Get-Location).Path
    
    # 1. Conversion de l'icône PNG en ICO
    $pngPath = Join-Path $currentDir "build\icons\256x256.png"
    $icoPath = Join-Path $currentDir "build\icon.ico"
    if (Test-Path $pngPath) {
        $pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
        $pngSize = $pngBytes.Length
        $icoHeader = [byte[]]@(
            0, 0, 1, 0, 1, 0,
            0, 0, 0, 0, 1, 0, 32, 0,
            ($pngSize -band 0xff), ([math]::Floor($pngSize / 256) -band 0xff), ([math]::Floor($pngSize / 65536) -band 0xff), ([math]::Floor($pngSize / 16777216) -band 0xff),
            22, 0, 0, 0
        )
        $icoBytes = New-Object byte[] ($icoHeader.Length + $pngBytes.Length)
        [System.Buffer]::BlockCopy($icoHeader, 0, $icoBytes, 0, $icoHeader.Length)
        [System.Buffer]::BlockCopy($pngBytes, 0, $icoBytes, $icoHeader.Length, $pngBytes.Length)
        [System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
    }

    # 2. Création de start.vbs pour lancer l'app en arrière-plan sans terminal
    $vbsPath = Join-Path $currentDir "start.vbs"
    $vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c start.bat", 0, False
"@
    [System.IO.File]::WriteAllText($vbsPath, $vbsContent)

    # 3. Création du raccourci .lnk sur le Bureau
    $desktopPath = [System.IO.Path]::Combine([Environment]::GetFolderPath("Desktop"), "Scarlet Base.lnk")
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($desktopPath)
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = "`"$vbsPath`""
    $Shortcut.WorkingDirectory = $currentDir
    if (Test-Path $icoPath) {
        $Shortcut.IconLocation = "$icoPath,0"
    }
    $Shortcut.Description = "Lancer Scarlet Base"
    $Shortcut.Save()
    Write-Host "  ✓ Icône ICO générée et raccourci créé sur le Bureau Windows (sans terminal)." -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Impossible de créer le raccourci sur le Bureau." -ForegroundColor Yellow
}

# ÉTAPE 4 — Lancement de l'application
Write-Host ""
if ($HAS_UI) {
    $choiceApp = Read-Host "Voulez-vous lancer l'application en mode développement maintenant ? (O/N)"
} else {
    $choiceApp = "N"
}
if ($choiceApp -match '^[OoYy]') {
    Write-Host "Lancement de Scarlet Base via start.ps1..." -ForegroundColor Green
    ./start.ps1
} else {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "✔ Installation terminée avec succès !" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Pour lancer le projet plus tard :"
    Write-Host "  ./start.ps1" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Pour compiler pour la production :"
    Write-Host "  npm run build" -ForegroundColor Blue
    Write-Host "==========================================================" -ForegroundColor Green
}
