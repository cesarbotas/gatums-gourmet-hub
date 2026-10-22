#!/bin/bash
set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

DEPLOY_PATH="${DEPLOY_PATH:-$(pwd)}"

echo "=========================================="
echo "  Gatums Gourmet — Deploy SITE (Node SSR)"
echo "=========================================="

echo -e "${YELLOW}[1/4] Verificando pré-requisitos...${NC}"
if [ ! -f "${DEPLOY_PATH}/.env" ]; then
    echo -e "${RED}.env não encontrado em ${DEPLOY_PATH}!${NC}"; exit 1
fi
# A imagem é construída no CI e carregada via `docker load`. A VPS não builda.
if ! docker image inspect gatums-site:latest >/dev/null 2>&1; then
    echo -e "${RED}Imagem gatums-site:latest não encontrada. O CI deve carregá-la (docker load) antes.${NC}"; exit 1
fi
echo -e "${GREEN}.env e imagem OK${NC}"

echo -e "${YELLOW}[2/4] Parando container antigo...${NC}"
docker compose -f "${DEPLOY_PATH}/docker-compose.production.yml" --env-file "${DEPLOY_PATH}/.env" down 2>/dev/null || true

echo -e "${YELLOW}[3/4] Subindo container (sem build — imagem pré-carregada)...${NC}"
docker compose -f "${DEPLOY_PATH}/docker-compose.production.yml" --env-file "${DEPLOY_PATH}/.env" up -d

echo -e "${YELLOW}[4/4] Health check...${NC}"
sleep 8
STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8090/ || echo "000")
if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}Site OK (HTTP 200)${NC}"
else
    echo -e "${YELLOW}Health check retornou ${STATUS}. Últimos logs:${NC}"
    docker logs gatums-site --tail 30
fi

echo -e "${GREEN}Deploy do site concluído!${NC}"
echo "  https://app.gatumsgourmet.com.br"
