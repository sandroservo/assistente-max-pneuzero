# DNS para vi.amovidas.com.br

O site da Assistente Vi só abre quando o domínio aponta para o servidor correto.

## Problema atual
- **vi.amovidas.com.br** está apontando para: `134.199.221.156`
- O servidor onde o app está rodando é: **`24.144.95.220`**

## O que fazer

1. Acesse o painel onde você gerencia o DNS de **amovidas.com.br** (registro.br, Cloudflare, GoDaddy, etc.).

2. Edite o registro do subdomínio **vi** (ou **vi.amovidas.com.br**):
   - **Tipo:** A
   - **Nome/Host:** `vi` (ou `vi.amovidas.com.br`, conforme o painel)
   - **Valor/Destino:** `24.144.95.220`
   - **TTL:** 300 ou 3600 (opcional)

3. Salve e aguarde a propagação (alguns minutos até algumas horas).

4. Depois de propagar, teste:
   ```bash
   # Deve retornar 24.144.95.220
   dig +short vi.amovidas.com.br
   ```
   Ou abra no navegador: https://vi.amovidas.com.br

## Se usar Cloudflare
- Crie ou edite o registro **A** para `vi` → `24.144.95.220`.
- Pode deixar o proxy (nuvem laranja) ligado; em **SSL/TLS** use **Full** ou **Full (strict)**.
- Se mesmo assim não abrir, desative o proxy (nuvem cinza) temporariamente para testar direto no servidor.
