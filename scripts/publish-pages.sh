#!/bin/sh
# Publica a demonstração no GitHub Pages.
#
# Gera a versão estática com o prefixo do repositório e envia o resultado para
# o branch gh-pages, que é a origem configurada no GitHub Pages.
set -e

REPO_NAME=${REPO_NAME:-assistente_humano}
REMOTE=$(git remote get-url origin)

rm -rf out
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH="/$REPO_NAME" npx next build

# Sem isso o GitHub Pages ignora a pasta _next (começa com sublinhado).
touch out/.nojekyll

cd out
git init -q -b gh-pages
git add -A
git commit -q -m "Publica demonstração"
git push -f "$REMOTE" gh-pages
rm -rf .git

echo "Publicado: https://erichprates.github.io/$REPO_NAME/"
