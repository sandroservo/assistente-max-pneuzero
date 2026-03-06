#!/bin/bash
set -euo pipefail

DOMAIN="pneuzero.cloudservo.com.br"
APP_DIR="/www/pneuzero"
APP_PORT=3001
DB_NAME="pneuzero"
DB_USER="pneuzero_app"
DB_PASS="Pn3uz3r0_DB_2026!"

export DEBIAN_FRONTEND=noninteractive

echo "=== [5/8] Configurando banco de dados ==="
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS' CREATEDB;\""
echo "  Usuario OK"

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
echo "  Database OK"

su - postgres -c "psql -d $DB_NAME -c 'CREATE EXTENSION IF NOT EXISTS vector;'"
su - postgres -c "psql -d $DB_NAME -c 'CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";'"
echo "  Extensoes OK"

PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -1)
if ! grep -q "$DB_USER" "$PG_HBA" 2>/dev/null; then
  echo "host    $DB_NAME    $DB_USER    127.0.0.1/32    scram-sha-256" >> "$PG_HBA"
  systemctl reload postgresql
fi
echo "  pg_hba OK"

echo ""
echo "=== [6/8] Instalando Nginx ==="
apt-get install -y nginx > /dev/null 2>&1
systemctl enable nginx

cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name pneuzero.cloudservo.com.br;

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
        client_max_body_size 50M;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx OK"

echo ""
echo "=== [7/8] Instalando Certbot ==="
apt-get install -y certbot python3-certbot-nginx > /dev/null 2>&1
echo "  Certbot instalado"
echo "  Para SSL: certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@pneuzero.com.br"

echo ""
echo "=== [8/8] Preparando diretorio da aplicacao ==="
mkdir -p $APP_DIR

cat > /etc/systemd/system/pneuzero-app.service << EOF
[Unit]
Description=Pneuzero Assistente Max (Next.js)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/node_modules/.bin/next start -p $APP_PORT
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pneuzero-app
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pneuzero-app
echo "  Systemd service OK"

echo ""
echo "========================================="
echo "  SETUP CONCLUIDO!"
echo "  Node: $(node -v)"
echo "  PG:   $(psql --version | head -1)"
echo "  DB:   postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo "  Dir:  $APP_DIR"
echo "========================================="
