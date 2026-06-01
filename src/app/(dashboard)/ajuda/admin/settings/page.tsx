/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Article, P, Section, Step, Tip, Warning, Note } from "@/components/ajuda/Article";

export default function SettingsTutorial() {
  return (
    <Article title="Configurações" subtitle="OpenAI, Evolution, instâncias WhatsApp e o prompt do Luma.">
      <P>
        A página <strong>/settings</strong> tem 4 áreas principais. Cada uma é detalhada abaixo.
      </P>

      <Section title="1. Credenciais OpenAI">
        <Step n={1} title="Crie uma API key em platform.openai.com">
          Vá em <em>API keys → Create new secret key</em>. Copie o valor (não dá pra ver de novo depois).
        </Step>
        <Step n={2} title="Cole em /settings → OpenAI API Key">
          O sistema guarda no banco (campo encrypted). Não fica em arquivo .env.
        </Step>
        <Step n={3} title="Escolha o modelo">
          Padrão: <code>gpt-4o-mini</code> (mais barato, ótima qualidade pro caso de uso). Para maior precisão, use
          <code> gpt-4o</code> — ~10x mais caro.
        </Step>
        <Warning>
          Token OpenAI gera custo por uso. Configure limite mensal em platform.openai.com pra evitar surpresa.
        </Warning>
      </Section>

      <Section title="2. Credenciais Evolution (WhatsApp)">
        <Step n={1} title="Base URL">
          URL do servidor Evolution onde a instância roda. Ex: <code>https://evolution.empresa.com.br/api</code>.
        </Step>
        <Step n={2} title="Token global">
          Token gerado no setup do Evolution. Não confundir com token específico da instância.
        </Step>
        <Step n={3} title="Salvar">
          Após salvar, vá em Instâncias pra conectar o número.
        </Step>
      </Section>

      <Section title="3. Conectar instância WhatsApp (QR code)">
        <Step n={1} title="Crie a instância em /settings → Instâncias → Nova">
          Nome amigável (ex: &quot;WhatsApp Vendas&quot;) + nome técnico (sem espaços, ex: &quot;pneuzero-vendas&quot;).
        </Step>
        <Step n={2} title="Clique em Conectar">
          Sistema chama Evolution e mostra o QR code na tela.
        </Step>
        <Step n={3} title="Escaneie pelo WhatsApp do número">
          Celular &gt; WhatsApp &gt; ⚙️ Aparelhos conectados &gt; Conectar aparelho &gt; aponta câmera pro QR.
        </Step>
        <Step n={4} title="Aguarde status mudar pra CONNECTED">
          Pode levar 5-30s. Status aparece na lista de instâncias.
        </Step>
        <Note>
          Sessão WhatsApp persiste no servidor Evolution. Não precisa reescanear se servidor reiniciar — só se Meta
          banir ou desconectar manualmente do celular.
        </Note>
      </Section>

      <Section title="4. System prompt do Luma">
        <Step n={1} title="Abra /settings → Prompt do Luma">
          Editor de texto grande com o prompt atual.
        </Step>
        <Step n={2} title="Edite com cuidado">
          O prompt define personalidade, escopo, regras de uso de tools. Cada parágrafo importa.
        </Step>
        <Step n={3} title="Salve">
          Aplicação imediata — próxima mensagem do cliente já cai no prompt novo.
        </Step>
        <Warning>
          Antes de mudar o prompt em produção: copie o texto atual e salve em arquivo .txt local. Permite reverter
          se a mudança piorar o comportamento.
        </Warning>
        <Tip>
          Testes A/B: abra um número de teste, conecte em outra instância e teste o novo prompt antes de aplicar no
          número principal.
        </Tip>
      </Section>

      <Section title="Variáveis de ambiente vs Settings do banco">
        <P>
          Muitas credenciais existem em 2 lugares:
        </P>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li><strong>/etc/assistente-max/.env</strong> (servidor) — valores padrão, lidos no boot</li>
          <li><strong>Tabela Settings</strong> (banco) — sobrescreve o .env quando preenchido</li>
        </ul>
        <P>
          Ordem de prioridade: Settings &gt; ENV. Pra mudar OpenAI key sem reiniciar serviço, mude em /settings. Pra
          mudar credenciais raras que não cabem em UI, edite .env e dê <code>systemctl restart assistente-max</code>.
        </P>
      </Section>
    </Article>
  );
}
