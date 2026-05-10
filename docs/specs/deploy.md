# Deploy — Assistente Max em produção

**Data análise**: 2026-05-10
**Servidor**: 64.23.167.206 (DigitalOcean)
**Hostname**: `debian-s-agencyos`
**OS**: Debian 13 (trixie)

## Inventário do servidor

| Item | Valor |
|------|-------|
| CPU | 2 cores |
| RAM | 3.8 GB (uso atual ~1.1 GB; livre ~2.7 GB) |
| Disco | 79 GB (uso 8%; livre ~70 GB) |
| Uptime | ~36 dias |
| Node | 22.22.2 (em `/usr/bin/node`) |
| Postgres | 17 (porta 5432, localhost) com extensão pgvector já em uso por `maika` (verificar) |
| Nginx | 1.26.3 |
| fail2ban | ativo |
| unattended-upgrades | ativo |

## Apps já rodando (NÃO TOCAR)

| App | Tipo | Porta | DB | Domínio | Diretório |
|-----|------|-------|-----|---------|-----------|
| **agencyos** | Express API | (interna) | `agencyos` | (via nginx site `agencyos`) | `/opt/agency-manager` |
| **maika** | Next.js 16 | 3002 ou 3003 | `maika` | `bibliotecadv.cloudservo.com.br` | `/opt/maika` |
| **stockflow** | Next.js standalone | 3000 ou 3001 | `stockflow` | (site `stockflow`) | `/opt/stockflow` |
| **suporte5** | Express API | (interna) | `suporte5` | (site `suporte5`) | `/opt/suporte5` |

Cada app tem usuário Linux dedicado (`agencyos`, `maika`, `suporte5`; stockflow com UID 1000).

## Portas em uso (LISTEN)

```
22  ssh
25  exim4 (localhost)
53  systemd-resolved
80  nginx (HTTP)
443 nginx (HTTPS)
3000 node (stockflow ou maika)
3001 node (stockflow ou maika)
3002 next-server
3003 next-server
5432 postgres (localhost)
```

**Próximas portas livres**: 3004, 3005, ...

## Plano de deploy do Assistente Max

Seguir o padrão do servidor:

| Item | Valor |
|------|-------|
| Usuário Linux | `assistente-max` (system user, sem login) |
| Diretório | `/opt/assistente-max/` |
| Porta interna | `3004` |
| DB Postgres | `assistente_max` (mesma instância 5432; user dedicado) |
| User DB | `assistente_max` (senha gerada com `openssl rand -hex 24`) |
| Extensões DB | `vector`, `uuid-ossp` (criar no banco novo) |
| Domínio | **A DEFINIR** — sugestões: `max.pneuzeromaranhao.com.br` ou `max.cloudservo.com.br` ou `assistentemax.cloudservo.com.br` |
| systemd service | `assistente-max.service` |
| Logs | journalctl (-u assistente-max) + `/var/log/assistente-max/` (followups, nginx) |
| Cron | `/etc/cron.d/assistente-max-followup` (job `*/10 * * * *`) |

### Estrutura no servidor

```
/opt/assistente-max/
  releases/
    20260510-201500-abc1234/    # cada deploy nesta pasta
    20260510-220000-def5678/
  current -> releases/20260510-220000-def5678   # symlink atômico
  shared/
    .env -> /etc/assistente-max/.env             # symlink para env persistente
    public/uploads/                              # mídia (se persistir local)

/etc/assistente-max/.env       (chmod 600, owner assistente-max)
/var/log/assistente-max/
  followups.log
  app.log
  app.err.log

/etc/systemd/system/assistente-max.service
/etc/cron.d/assistente-max-followup
/etc/nginx/sites-available/assistente-max
/etc/nginx/sites-enabled/assistente-max -> ../sites-available/assistente-max
```

### Variáveis do `.env` em produção

```env
NODE_ENV=production
DATABASE_URL=postgresql://assistente_max:<senha>@localhost:5432/assistente_max?schema=public
OPENAI_API_KEY=sk-...                     # ★ pendente do dono
EVOLUTION_BASE_URL=https://...            # ★ pendente do dono
EVOLUTION_INSTANCE=pneuzero
EVOLUTION_TOKEN=...                        # ★ pendente do dono
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=https://<subdomínio-decidido>
```

★ = decisão/credencial pendente do dono.

## Status: 🟢 DEPLOY EM PRODUÇÃO

Deploy inicial executado em **2026-05-10 20:57 UTC**.

| Item | Valor |
|------|-------|
| URL | https://pneuzero.cloudservo.com.br |
| Release ativa | `20260510-175357-d68714b50e` |
| Service | `assistente-max.service` (active running, ~135MB RAM) |
| Porta interna | 3004 |
| DB | `assistente_max` em Postgres 17 (extensions: vector 0.8.0, uuid-ossp 1.1) |
| User Linux | `assistente-max` |
| Admin login | `admin@pneuzero.com.br` / `admin@01` (★ trocar senha no primeiro acesso) |
| SSL | Let's Encrypt (renova automático até 2026-08-08); Cloudflare proxy ativo |
| Cron follow-up | `*/10 * * * *` em `/etc/cron.d/assistente-max-followup` (testado OK) |

## Como fazer deploy de novas versões

```bash
# Localmente
git push origin main
./scripts/deploy-prod.sh
```

Outras operações via script: `./scripts/deploy-prod.sh {status|logs|followlogs|followups|releases|rollback}`

## Estado pós primeiro deploy

- 1 Organization (Pneuzero) + 1 User (admin)
- 8 ServiceCategory + 6 ServiceItem (catálogo real)
- 8 FollowUpRule + 14 Knowledge
- 0 Lead / Vehicle / Quote / Sale / NPS — começa zerado em produção

## Comandos de operação

```bash
# Status
ssh root@64.23.167.206 "systemctl status assistente-max"

# Logs em tempo real
ssh root@64.23.167.206 "journalctl -u assistente-max -f"

# Logs follow-up
ssh root@64.23.167.206 "tail -f /var/log/assistente-max/followups.log"

# Restart
ssh root@64.23.167.206 "systemctl restart assistente-max"

# Backup do DB
ssh root@64.23.167.206 "sudo -u postgres pg_dump assistente_max | gzip > /var/backups/assistente_max-$(date +%F).sql.gz"

# Health check
curl -sf https://<subdomain>/api/auth/session

# Rollback (trocar symlink current)
ssh root@64.23.167.206 'ls -1t /opt/assistente-max/releases | head -3'
ssh root@64.23.167.206 'ln -sfn /opt/assistente-max/releases/<previous> /opt/assistente-max/current && systemctl restart assistente-max'
```

## NÃO fazer no servidor

- `apt upgrade -y` sem coordenar (pode reiniciar postgres/nginx e afetar outras apps).
- `systemctl restart nginx` sem `nginx -t` antes.
- `prisma migrate reset` (apaga banco).
- Editar config de outra app (`/etc/nginx/sites-available/<outra>`).
- Compartilhar database/role com outra app.
- Bind em portas 80/443/3000/3001/3002/3003/5432 — todas em uso.
- `kill -9` em PIDs não identificados.
- `docker prune` (não há docker, mas evitar caso instalem).
- `ufw default deny` se firewall existir (verificar antes).

---

## Referências internas

- Especificação produto: [00-visao-geral.md](00-visao-geral.md)
- Schema banco: [data-model.md](data-model.md)
- Job de follow-up: [04-fase4-pos-venda.md](04-fase4-pos-venda.md)
- Agente devops: [.claude/agents/devops.md](../../.claude/agents/devops.md)
