#!/usr/bin/env bash
# Autor: Sandro Servo
# Site: https://cloudservo.com.br
#
# Deploy do Assistente Max em produção (servidor 64.23.167.206).
# Idempotente. Cria release imutável + symlink atômico para rollback fácil.
#
# Uso:
#   scripts/deploy-prod.sh              → deploy de HEAD
#   scripts/deploy-prod.sh rollback     → volta para release anterior
#   scripts/deploy-prod.sh status       → status do serviço
#   scripts/deploy-prod.sh logs         → últimos 100 logs
#   scripts/deploy-prod.sh followlogs   → tail -f
#
# Pré-requisitos:
#   - Repo já com commits pushed (git push origin main)
#   - SSH para root@64.23.167.206 funcionando (chave em ~/.ssh/id_rsa)
#   - /etc/assistente-max/.env já configurado no servidor
#   - Banco assistente_max já provisionado

set -euo pipefail

SERVER="root@64.23.167.206"
APP_DIR="/opt/assistente-max"
SERVICE="assistente-max"
HEALTHCHECK_URL="https://pneuzero.cloudservo.com.br/login"

cmd="${1:-deploy}"

ssh_run() {
  ssh -o ConnectTimeout=10 "$SERVER" "$@"
}

case "$cmd" in
  deploy)
    SHA=$(git rev-parse --short=10 HEAD)
    TS=$(date +%Y%m%d-%H%M%S)
    REL="${TS}-${SHA}"
    echo "→ Deploy $REL"

    # Garantia: HEAD foi pushed
    if ! git ls-remote --heads origin main | grep -q "$(git rev-parse HEAD)"; then
      echo "✗ HEAD não está no GitHub. Rode: git push origin main"
      exit 1
    fi

    ssh_run bash -s <<EOF
set -e
cd $APP_DIR/releases
sudo -u assistente-max git clone --depth 1 https://github.com/sandroservo/assistente-max-pneuzero.git $REL
cd $REL
sudo -u assistente-max ln -sf /etc/assistente-max/.env .env
echo '→ npm ci'
sudo -u assistente-max npm ci --no-audit --no-fund 2>&1 | tail -3
echo '→ prisma generate'
sudo -u assistente-max npx prisma generate 2>&1 | tail -3
echo '→ prisma db push (best-effort — schema tem colunas GENERATED que o Prisma não modela)'
# ATENÇÃO: este banco usa colunas tsvector GENERATED (FTS de Message/LeadMemory)
# que o Prisma db push NÃO consegue reconciliar (tenta DROP DEFAULT → erra).
# Push é all-or-nothing → NÃO aplica mudanças aqui e NUNCA deve abortar o deploy.
# → Mudou o schema? Aplique via SQL manual (psql). Ver docs/specs/deploy.md.
if sudo -u assistente-max bash -c 'set -a && source .env && set +a && npx prisma db push --schema=prisma/schema.prisma --skip-generate' > /tmp/dbpush.out 2>&1; then
  echo '   db push OK'
else
  echo '⚠️  db push NÃO aplicou (esperado neste banco — colunas GENERATED). Mudanças de schema exigem SQL manual. Deploy segue.'
fi
tail -5 /tmp/dbpush.out || true
echo '→ build'
sudo -u assistente-max bash -c 'set -a && source .env && set +a && npm run build' 2>&1 | tail -3
echo '→ symlink current'
ln -sfn $APP_DIR/releases/$REL $APP_DIR/current
echo '→ restart service'
systemctl restart $SERVICE
sleep 4
systemctl is-active $SERVICE
echo '→ cleanup releases antigas (mantém últimas 3)'
ls -1t $APP_DIR/releases | tail -n +4 | xargs -r -I {} rm -rf $APP_DIR/releases/{}
EOF

    echo "→ Health check"
    code=$(curl -sk -o /dev/null -w '%{http_code}' "$HEALTHCHECK_URL")
    if [[ "$code" == "200" ]]; then
      echo "✓ OK (HTTP $code) — $REL ativo"
    else
      echo "✗ Health check retornou HTTP $code"
      exit 1
    fi
    ;;

  rollback)
    ssh_run bash -s <<EOF
set -e
prev=\$(ls -1t $APP_DIR/releases | sed -n '2p')
[ -z "\$prev" ] && { echo 'Sem release anterior'; exit 1; }
echo "→ Rollback para \$prev"
ln -sfn $APP_DIR/releases/\$prev $APP_DIR/current
systemctl restart $SERVICE
sleep 3
systemctl is-active $SERVICE
EOF
    ;;

  status)
    ssh_run "systemctl status $SERVICE --no-pager | head -20"
    ;;

  logs)
    ssh_run "journalctl -u $SERVICE -n 100 --no-pager"
    ;;

  followlogs)
    ssh_run "journalctl -u $SERVICE -f"
    ;;

  followups)
    ssh_run "tail -100 /var/log/assistente-max/followups.log"
    ;;

  releases)
    ssh_run "ls -1t $APP_DIR/releases"
    ;;

  *)
    echo "Uso: $0 {deploy|rollback|status|logs|followlogs|followups|releases}"
    exit 1
    ;;
esac
