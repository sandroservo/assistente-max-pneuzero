# Deploy do Assistente Max (pneuzero.cloudservo.com.br)

Deploy no servidor Pneuzero.

## Pré-requisitos no servidor

1. **Node.js** (>= 22.12.0, conforme `package.json`)
2. **PostgreSQL** (pode ser o mesmo do sistema, com outro database, ex: `pneuzero`)
3. **Nginx** (para proxy e SSL)
4. **Certificado SSL** para `pneuzero.cloudservo.com.br` (Let's Encrypt)

## Primeira vez no servidor

### 1. Clonar o repositório

```bash
ssh root@192.168.40.104
mkdir -p /www
cd /www
git clone <URL_DO_REPOSITORIO> pneuzero
cd pneuzero
```

### 2. Criar `.env`

```bash
cp .env.example .env
nano .env
```

Preencha pelo menos:

- `DATABASE_URL` – PostgreSQL (pode criar um DB `pneuzero`)
- **`AUTH_SECRET`** – gere com: `openssl rand -base64 32` (obrigatório para login em produção; o código também aceita `NEXTAUTH_SECRET`)
- **`AUTH_URL=https://pneuzero.cloudservo.com.br`** – URL pública do site (obrigatório em produção para o login não redirecionar para localhost; se usar proxy, o código já usa `trustHost: true`)

### 3. Rodar migrações e seed (se necessário)

```bash
npx prisma migrate deploy
npm run build
# Opcional: seed admin/knowledge
# npx tsx scripts/seed-admin.ts
```

### 4. Instalar e ativar o serviço systemd

```bash
sudo cp scripts/assistente-vi-app.service /etc/systemd/system/assistente-max-app.service
sudo systemctl daemon-reload
sudo systemctl enable assistente-max-app
sudo systemctl start assistente-max-app
sudo systemctl status assistente-max-app
```

### 5. Configurar Nginx

- Configure o Nginx como proxy reverso para `http://127.0.0.1:3001`.
- Ajuste os caminhos do SSL se precisar.

### 6. Certificado SSL para pneuzero.cloudservo.com.br

Antes do HTTPS funcionar, o DNS de `pneuzero.cloudservo.com.br` deve apontar para o IP do servidor. Depois:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d pneuzero.cloudservo.com.br
sudo nginx -t && sudo systemctl reload nginx
```

## Deploy contínuo (a partir da sua máquina)

Na pasta **assistente-max** (ou na raiz do repo):

```bash
bash scripts/deploy.sh
```

O script vai:

1. Conectar no servidor
2. Fazer `git pull` em `/www/pneuzero`
3. `npm ci`, `npm run build`, reiniciar o serviço `assistente-max-app`

## URLs

- Produção: **https://pneuzero.cloudservo.com.br**
- Serviço no servidor: `http://127.0.0.1:3001`

## Comandos úteis no servidor

```bash
# Logs do assistente
sudo journalctl -u assistente-max-app -f

# Reiniciar
sudo systemctl restart assistente-max-app

# Status
sudo systemctl status assistente-max-app
curl -I http://127.0.0.1:3001
```
