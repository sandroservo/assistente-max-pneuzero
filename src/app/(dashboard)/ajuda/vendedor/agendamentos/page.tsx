/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Article, P, Section, Step, Tip, Note, HelpImage, Checklist } from "@/components/ajuda/Article";

export default function AgendamentosTutorial() {
  return (
    <Article title="Agendamentos" subtitle="Marcar manutenção, ver agenda do dia, concluir ou cancelar serviços.">
      <P>
        A página <strong>/agendamentos</strong> mostra a agenda da Pneuzero agrupada por dia. Cada item tem
        cliente, serviço, hora, veículo e status. Vendedor cria manual; Max cria automático quando combina com cliente
        no WhatsApp.
      </P>

      <HelpImage src="/ajuda/agendamentos-lista.png" videoSrc="/ajuda/agendamentos-lista.webm" alt="Lista de agendamentos" caption="Lista /agendamentos — agrupada por dia, com hora destacada em vermelho" />

      <HelpImage src="/ajuda/agendamentos-modal.png" videoSrc="/ajuda/agendamentos-modal.webm" alt="Modal Novo agendamento" caption="Modal 'Novo agendamento' — busca de cliente + selectbox de serviços do catálogo" />

      <Section title="Criar agendamento manual">
        <Step n={1} title="Clique em 'Novo agendamento'">
          Botão vermelho no canto superior direito da página.
        </Step>
        <Step n={2} title="Busque o cliente">
          Digite nome ou telefone. A lista filtra em tempo real. Selecione o cliente.
        </Step>
        <Step n={3} title="Selecione o serviço">
          Selectbox traz catálogo agrupado por categoria (Alinhamento, Freios, Suspensão, etc) com preço base
          e duração em minutos. Se o serviço não estiver no catálogo, escolha &quot;— Outro (digitar nome) —&quot;.
        </Step>
        <Step n={4} title="Data e hora">
          Campo datetime — escolha dia e hora exata.
        </Step>
        <Step n={5} title="Observações (opcional)">
          Ex: &quot;cliente prefere ser atendido pelo João&quot;, &quot;trazer nota da compra anterior&quot;.
        </Step>
        <Step n={6} title="Clique em Criar">
          Agendamento aparece na lista + alerta automático no canal Geral do /equipe.
        </Step>
      </Section>

      <Section title="Concluir um agendamento (cliente compareceu e foi atendido)">
        <Step n={1} title="Localize na lista do dia">
          Use a busca por nome/telefone se a lista estiver longa.
        </Step>
        <Step n={2} title="Clique em 'Concluir'">
          Botão azul. Status vira <strong>Concluído</strong>. Aparece em cinza no dia seguinte.
        </Step>
      </Section>

      <Section title="Cancelar agendamento">
        <Step n={1} title="Localize na lista">
          Mesma busca.
        </Step>
        <Step n={2} title="Clique em 'Cancelar'">
          Confirma a ação. Opcionalmente, digite o motivo (vai pro histórico).
        </Step>
      </Section>

      <Section title="Filtros úteis">
        <Checklist
          items={[
            "Buscar por cliente, telefone ou serviço — campo de busca no topo",
            "Filtrar por status — Confirmados, Pendentes, Concluídos, Cancelados, Não compareceu",
            "Período padrão: mês atual + próximo mês",
          ]}
        />
      </Section>

      <Section title="Como o Max marca automático">
        <P>
          Quando cliente diz no WhatsApp algo como <em>&quot;quero agendar alinhamento sábado 14h&quot;</em>:
        </P>
        <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
          <li>Max repete os dados pra confirmar: &quot;Vou marcar alinhamento sábado 18/05 às 14h. Pode ser?&quot;</li>
          <li>Cliente responde &quot;sim&quot; ou &quot;pode marcar&quot;</li>
          <li>Max grava o agendamento + posta no Geral do /equipe</li>
          <li>Agendamento aparece automaticamente na sua lista</li>
        </ol>
        <Note>
          Max NUNCA marca sem confirmação do cliente. Se ele cancelar via WhatsApp depois (&quot;preciso desmarcar
          sábado&quot;), o Max cancela e também avisa no Geral.
        </Note>
      </Section>

      <Section title="Lembrete automático 24h antes">
        <P>
          Todo dia às 9h, o sistema dispara mensagem WhatsApp pros clientes com agendamento marcado pra dia seguinte:
        </P>
        <blockquote className="border-l-4 border-gray-200 pl-3 italic text-gray-600 text-sm">
          Oi João! Aqui é o Max da Pneu Zero 🛞. Só passando pra lembrar do seu Alinhamento marcado pra amanhã às 14h.
          Está confirmado? Se precisar remarcar, é só me avisar por aqui.
        </blockquote>
        <P>
          Se cliente responder confirmando ou pedindo pra remarcar, cai na conversa normal pelo Max.
        </P>
      </Section>

      <Section title="Ver agendamentos de um cliente específico">
        <P>
          Na ficha do lead (Lead 360°), tem aba <strong>Agendamentos</strong> com o histórico completo desse cliente —
          passados, atuais e cancelados.
        </P>
      </Section>

      <Tip>
        Se cliente pede pra remarcar mas você não consegue ver na lista, abra a Lead 360° dele pela aba Chats — lá
        aparece o histórico inteiro de agendamentos, mesmo cancelados.
      </Tip>
    </Article>
  );
}
