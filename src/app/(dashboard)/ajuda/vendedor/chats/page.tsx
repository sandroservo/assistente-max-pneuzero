/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Article, P, Section, Step, Tip, Note, Checklist, HelpImage } from "@/components/ajuda/Article";

export default function ChatsTutorial() {
  return (
    <Article title="Inbox /chats" subtitle="Responder leads, transferir conversa, enviar mídia e fechar atendimento.">
      <P>
        A <strong>Inbox</strong> mostra todas as conversas em andamento, agrupadas por status, com prévia da última mensagem
        e badge de não lidas. O cabeçalho de cada lead exibe nome, telefone, score e quem está dono da conversa (bot ou humano).
      </P>

      <HelpImage src="/ajuda/chats-inbox.png" videoSrc="/ajuda/chats-inbox.webm" alt="Inbox /chats" caption="Inbox /chats — sidebar de conversas à esquerda, conversa selecionada à direita" />

      <Section title="Como abrir uma conversa">
        <Step n={1} title="Vá em Chats no menu lateral">
          O ícone é uma nuvem de balão. O badge vermelho mostra o total de conversas com mensagens não lidas.
        </Step>
        <Step n={2} title="Use a busca no topo">
          Procure por nome, telefone, ou trecho de mensagem. A busca é em tempo real.
        </Step>
        <Step n={3} title="Clique na conversa">
          O histórico completo abre à direita. Mensagens do cliente aparecem à esquerda; respostas (suas ou do Max) à direita em vermelho.
        </Step>
      </Section>

      <Section title="Identificar quem está respondendo">
        <P>
          O badge ao lado do nome do lead mostra:
        </P>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li><strong className="text-emerald-700">Max (bot)</strong> — o assistente está respondendo sozinho</li>
          <li><strong className="text-blue-700">Humano</strong> — algum vendedor já assumiu a conversa</li>
          <li><strong className="text-amber-700">Aguardando humano</strong> — handoff aberto, ninguém pegou ainda</li>
        </ul>
      </Section>

      <Section title="Assumir uma conversa do Max">
        <Step n={1} title="Lead com handoff aparece destacado no /equipe">
          Quando Max transfere, posta no canal Geral: <em>🆘 Transferência para humano — &lt;nome&gt; — &lt;motivo&gt;</em>.
        </Step>
        <Step n={2} title="Clique no nome do cliente no alerta">
          Vai direto pra conversa.
        </Step>
        <Step n={3} title="Mande sua primeira mensagem">
          Basta digitar e enviar. O sistema reconhece automaticamente que <strong>você</strong> respondeu — marca a conversa
          como atendida por humano e o Max não responde mais sozinho.
        </Step>
      </Section>

      <Note>
        Quando você manda uma mensagem pela Inbox, o sistema usa a Evolution API pra enviar do número da Pneuzero.
        O cliente recebe como mensagem normal do WhatsApp.
      </Note>

      <Section title="Enviar mídia (foto, áudio, documento)">
        <Checklist
          items={[
            "Clique no ícone de clipe (📎) ao lado do campo de mensagem",
            "Selecione o arquivo do seu computador",
            "Adicione uma legenda (opcional)",
            "Clique em Enviar",
          ]}
        />
      </Section>

      <Section title="Devolver conversa pro Max">
        <P>
          Se o cliente já foi atendido e quer voltar pro fluxo automático (ex: pediu agendamento, você fechou, agora ele quer só receber lembretes):
        </P>
        <Step n={1} title="Botão 'Devolver ao bot' no topo da conversa">
          Reativa o Max para esse lead. Próxima mensagem do cliente cai novamente no fluxo automático.
        </Step>
      </Section>

      <Tip>
        Se um lead some por dias e você quer reaquecer, mande uma mensagem manual perguntando se está tudo certo. O Max
        retoma do contexto se o cliente responder.
      </Tip>

      <Section title="Status do lead (canto superior direito)">
        <P>
          O status muda automaticamente conforme a conversa evolui (NOVO → EM_NEGOCIACAO → QUALIFICADO → FECHADO).
          Você também pode mudar manualmente clicando no status — útil quando o lead some ou quando vira venda direta.
        </P>
      </Section>
    </Article>
  );
}
