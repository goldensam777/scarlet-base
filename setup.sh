#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Reset

echo -e "${BLUE}==========================================================${NC}"
echo -e "${GREEN}         Scarlet Base - Assistant d'Installation 🤖       ${NC}"
echo -e "${BLUE}==========================================================${NC}"
echo "Ce script va préparer le projet sur votre machine :"
echo "1. Vérification des outils requis (git, node, npm)"
echo "2. Mise à jour facultative du dépôt"
echo "3. Installation des dépendances npm"
echo "4. Lancement optionnel de VS Code et de l'application"
echo ""

# ÉTAPE 1 — Vérifications
echo -e "${BLUE}→ Étape 1 : Vérification des prérequis...${NC}"

check_tool() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 n'est pas installé.${NC}"
        echo -e "→ Veuillez installer $1 ($2) puis relancer ce script."
        exit 1
    else
        echo -e "  ${GREEN}✓ $1 trouvé${NC}"
    fi
}

check_tool "git"  "https://git-scm.com"
check_tool "node" "https://nodejs.org"
check_tool "npm"  "https://nodejs.org"

# ÉTAPE 2 — Mise à jour Git si applicable
echo -e "\n${BLUE}→ Étape 2 : Vérification des mises à jour...${NC}"
if [ -d ".git" ]; then
    echo "Dépôt Git détecté. Tentative de pull..."
    if git pull --ff-only; then
        echo -e "  ${GREEN}✓ Projet à jour.${NC}"
    else
        echo -e "  ${YELLOW}⚠ Impossible de mettre à jour automatiquement (historique divergé).${NC}"
        echo "  On continue avec la version locale actuelle."
    fi
else
    echo "Aucun dépôt Git détecté au dossier courant, passage à l'étape suivante."
fi

# ÉTAPE 3 — npm install
echo -e "\n${BLUE}→ Étape 3 : Installation des dépendances npm...${NC}"
if npm install; then
    echo -e "  ${GREEN}✓ Dépendances installées avec succès.${NC}"
else
    echo -e "${RED}❌ Échec de l'installation des dépendances npm.${NC}"
    exit 1
fi

# ÉTAPE 4 — Ouverture VS Code
echo -e "\n${BLUE}→ Étape 4 : Lancement et IDE...${NC}"
if command -v code &> /dev/null; then
    read -p "Voulez-vous ouvrir le projet dans VS Code ? (O/n) : " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[OoYy]$ ]] || [[ -z $REPLY ]]; then
        echo "Ouverture de VS Code..."
        code .
    fi
else
    echo -e "${YELLOW}⚠ VS Code n'a pas été détecté dans le PATH.${NC}"
fi

# ÉTAPE 5 — Lancement de l'application
echo ""
read -p "Voulez-vous lancer l'application en mode développement maintenant ? (O/n) : " -n 1 -r
echo ""
if [[ $REPLY =~ ^[OoYy]$ ]] || [[ -z $REPLY ]]; then
    echo -e "${GREEN}Lancement de Scarlet Base...${NC}"
    npm run dev
else
    echo -e "${GREEN}==========================================================${NC}"
    echo -e "${GREEN}✔ Installation terminée avec succès !${NC}"
    echo -e "${GREEN}==========================================================${NC}"
    echo "Pour lancer le projet plus tard :"
    echo -e "  ${BLUE}npm run dev${NC}"
    echo ""
    echo "Pour compiler pour la production :"
    echo -e "  ${BLUE}npm run build${NC}"
    echo -e "${GREEN}==========================================================${NC}"
fi
