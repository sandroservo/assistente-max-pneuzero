/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Article, P, Section, Step, Tip, Note, HelpImage } from "@/components/ajuda/Article";

export default function EquipeTutorial() {
  return (
    <Article title="Chat interno /equipe" subtitle="Conversar com o time, receber alertas do Luma e mandar mensagem privada pra outro vendedor.">
      <P>
        O <strong>/equipe</strong> é o chat interno só do time da Pneuzero. Tem 2 espaços:
      </P>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
        <li><strong>Geral</strong> — canal único que todo mundo da loja vê. Anúncios, dúvidas rápidas, e alertas automáticos do Luma</li>
        <li><strong>PV (mensagem privada)</strong> — 1-a-1 com qualquer outro vendedor</li>
      </ul>

      <HelpImage src="/ajuda/equipe.png" videoSrc="/ajuda/equipe.webm" alt="/equipe chat interno" caption="Tela /equipe — sidebar com Geral + lista de vendedores, conversa ao centro" />

      <Section title="Mandar mensagem no canal Geral">
        <Step n={1} title="Abra /equipe no menu lateral">
          O badge mostra quantas mensagens novas você ainda não viu.
        </Step>
        <Step n={2} title="Clique em 'Geral' na sidebar">
          Histórico aparece no centro.
        </Step>
        <Step n={3} title="Digite e aperte Enter">
          Shift+Enter pula linha. O botão de smile abre o seletor de emojis (😀 👍 🚗 🛞 etc).
        </Step>
      </Section>

      <Section title="Conversar em PV com outro vendedor">
        <Step n={1} title="Lista de vendedores na sidebar">
          Abaixo do botão Geral aparece a lista. Iniciais coloridas no avatar.
        </Step>
        <Step n={2} title="Clique no nome da pessoa">
          Abre a conversa privada. Só vocês 2 veem.
        </Step>
        <Step n={3} title="Digite e envie">
          Funciona igual ao Geral. Badge vermelho com número aparece pra ela ser avisada.
        </Step>
      </Section>

      <Section title="Receber alertas do Luma">
        <P>
          O Luma posta automático no canal <strong>Geral</strong> em 3 situações:
        </P>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-2">
          <li>
            <strong>🆘 Transferência para humano</strong> — Luma não conseguiu responder ou cliente pediu atendente.
            Mostra nome, telefone, motivo e resumo.
          </li>
          <li>
            <strong>🗓️ Novo agendamento</strong> — Luma marcou serviço com cliente. Mostra serviço, data, veículo.
          </li>
          <li>
            <strong>❌ Agendamento cancelado</strong> — cliente desmarcou via WhatsApp.
          </li>
        </ul>
      </Section>

      <Section title="Notificações sonoras e do navegador">
        <P>
          Quando chega mensagem em canal/PV que você NÃO está olhando OU a aba está em segundo plano:
        </P>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>🔔 Toca beep curto (Web Audio)</li>
          <li>📣 Notificação do navegador aparece (precisa permitir uma vez)</li>
          <li>🔴 Badge unread aparece no menu lateral e no canal</li>
        </ul>
        <Note>
          Na primeira visita ao /equipe, clique no ícone de sino no topo da sidebar pra <strong>permitir notificações</strong>.
          Sem isso só o beep toca.
        </Note>
      </Section>

      <Section title="Status de conexão">
        <P>
          No topo da conversa fica um pontinho colorido:
        </P>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>🟢 <strong>Conectado</strong> — mensagens chegam em tempo real (SSE)</li>
          <li>🟡 <strong>Conectando</strong> — reconectando, espera alguns segundos</li>
          <li>🔴 <strong>Desconectado</strong> — sem rede ou servidor caiu. Recarregue a página</li>
        </ul>
      </Section>

      <Tip>
        Use o canal Geral pra perguntas técnicas rápidas tipo &quot;tem pneu 175/65 R14 da Continental?&quot; — outro
        vendedor pode responder mais rápido que abrir o ERP.
      </Tip>
    </Article>
  );
}
