#!/bin/bash
# Autor: Sandro Servo
# Site: https://cloudservo.com.br
#
# Script de setup completo do servidor para Pneuzero Assistente Max
# Debian 13 (trixie) — Node.js 22 + PostgreSQL 17 + pgvector + Nginx + Certbot

set -euo pipefail

DOMAIN="pneuzero.cloudservo.com.br"
APP_DIR="/www/pneuzero"
APP_PORT=3001
DB_NAME="pneuzero"
DB_USER="pneuzero_app"
DB_PASS="Pn3uz3r0_DB_2026!"
NODE_VERSION=22

echo "========================================="
echo "  Setup Servidor Pneuzero Assistente Max"
echo "========================================="

# ---- 1. Atualizar sistema ----
echo ""
echo "[1/8] Atualizando sistema..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl wget gnupg2 lsb-release ca-certificates git build-essential

# ---- 2. Instalar Node.js 22 ----
echo ""
echo "[2/8] Instalando Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt $NODE_VERSION ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

# ---- 3. Instalar PostgreSQL 17 ----
echo ""
echo "[3/8] Instalando PostgreSQL 17..."
if ! command -v psql &> /dev/null; then
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y postgresql-17 postgresql-server-dev-17
fi
systemctl enable postgresql
systemctl start postgresql
echo "PostgreSQL: $(psql --version)"

# ---- 4. Instalar pgvector ----
echo ""
echo "[4/8] Instalando pgvector..."
if ! dpkg -l | grep -q postgresql-17-pgvector; then
  apt-get install -y postgresql-17-pgvector 2>/dev/null || {
    echo "  Compilando pgvector do source..."
    cd /tmp
    git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git 2>/dev/null || true
    cd pgvector
    make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config
    make install PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config
    cd /
  }
fi

# ---- 5. Configurar banco de dados ----
echo ""
echo "[5/8] Configurando banco de dados..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" | grep -q 1 || {
  su - postgres -c "psql -c \"CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' CREATEDB;\""
  echo "  Usuário ${DB_USER} criado."
}
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1 || {
  su - postgres -c "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};\""
  echo "  Database ${DB_NAME} criada."
}
su - postgres -c "psql -d ${DB_NAME} -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
su - postgres -c "psql -d ${DB_NAME} -c 'CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";'"
echo "  Extensões vector e uuid-ossp habilitadas."

# Permitir conexão local com password
PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -1)
if ! grep -q "${DB_USER}" "$PG_HBA" 2>/dev/null; then
  sed -i "/^# IPv4 local connections/a host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    scram-sha-256" "$PG_HBA"
  systemctl reload postgresql
fi

# ---- 6. Instalar Nginx ----
echo ""
echo "[6/8] Instalando Nginx..."
apt-get install -y nginx
systemctl enable nginx

# Configurar virtual host
cat > /etc/nginx/sites-available/${DOMAIN} << 'NGINX_CONF'
server {
    listen 80;
    server_name pneuzero.cloudservo.com.br;

    # Redirect HTTP to HTTPS (ativado após certbot)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        # Tamanho máximo de upload (para mídia WhatsApp)
        client_max_body_size 50M;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx configurado para ${DOMAIN}"

# ---- 7. Instalar Certbot ----
echo ""
echo "[7/8] Instalando Certbot..."
apt-get install -y certbot python3-certbot-nginx
echo "  Certbot instalado. Execute manualmente após DNS estar apontando:"
echo "  certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m admin@pneuzero.com.br"

# ---- 8. Preparar diretório da aplicação ----
echo ""
echo "[8/8] Preparando diretório da aplicação..."
mkdir -p ${APP_DIR}

# Criar serviço systemd
cat > /etc/systemd/system/pneuzero-app.service << EOF
[Unit]
Description=Pneuzero Assistente Max (Next.js)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node ${APP_DIR}/node_modules/.bin/next start -p ${APP_PORT}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pneuzero-app
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pneuzero-app

echo ""
echo "========================================="
echo "  Setup do servidor CONCLUÍDO!"
echo "========================================="
echo ""
echo "  Node.js:     $(node -v)"
echo "  PostgreSQL:  $(psql --version | head -1)"
echo "  Nginx:       $(nginx -v 2>&1)"
echo "  Certbot:     $(certbot --version 2>&1)"
echo ""
echo "  DB Name:     ${DB_NAME}"
echo "  DB User:     ${DB_USER}"
echo "  DB Pass:     ${DB_PASS}"
echo "  App Dir:     ${APP_DIR}"
echo "  App Port:    ${APP_PORT}"
echo "  Domain:      ${DOMAIN}"
echo ""
echo "  Próximo passo: deploy da aplicação"
echo "========================================="
