#!/bin/bash

# Configuration d'environnement robuste - arrêt automatique en cas d'erreur
set -e

# Couleurs pour le terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # Pas de couleur (Reset)

echo "=========================================================="
echo "          TaskFlow - Installation du Projet"
echo "=========================================================="

# 1. Vérification de Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERREUR : Node.js n'est pas installé sur votre système.${NC}"
    echo "Veuillez télécharger et installer Node.js (version LTS recommandée) depuis : https://nodejs.org/"
    exit 1
fi

echo -e "✔ Node.js détecté : ${GREEN}$(node -v)${NC}"

# 2. Vérification de npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}ERREUR : npm n'est pas installé.${NC}"
    exit 1
fi

echo -e "✔ npm détecté : ${GREEN}$(npm -v)${NC}"

# 3. Installation des dépendances
echo -e "\n⚙ Installation des dépendances npm..."
npm install

# 4. Message de réussite
echo ""
echo "=========================================================="
echo -e "${GREEN}✔ Installation terminée avec succès !${NC}"
echo "=========================================================="
echo "Pour lancer le projet en mode développement :"
echo -e "  ${GREEN}npm run dev${NC}"
echo ""
echo "Pour compiler le projet pour la production :"
echo -e "  ${GREEN}npm run build${NC}"
echo "=========================================================="
