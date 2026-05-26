/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Article, P, Section, Step, Tip, HelpImage, Checklist } from "@/components/ajuda/Article";

export default function KanbanTutorial() {
  return (
    <Article title="Kanban & Lead 360°" subtitle="Organizar a pipeline de leads e ver tudo que sabemos de cada cliente.">
      <P>
        O <strong>Kanban</strong> é a visão das colunas de status do lead (NOVO → EM_NEGOCIACAO → QUALIFICADO →
        FECHADO etc). Mover o cartão entre colunas atualiza o status do lead. A <strong>Lead 360°</strong> é a ficha
        completa de um cliente — vida toda dele com a Pneuzero.
      </P>

      <HelpImage src="/ajuda/kanban.png" alt="Kanban de leads" caption="Kanban — colunas de status com cartões de leads que podem ser arrastados" />

      <Section title="Como ler o Kanban">
        <Checklist
          items={[
            "Cada coluna = um status do funil (NOVO, EM_NEGOCIACAO, QUALIFICADO, etc)",
            "Cada cartão = um lead. Mostra nome, telefone, score, última mensagem",
            "Borda colorida no cartão indica prioridade (vermelho = alta)",
            "Total de leads na coluna aparece no cabeçalho",
          ]}
        />
      </Section>

      <Section title="Mover lead entre colunas">
        <Step n={1} title="Arraste o cartão">
          Clique e segure no cartão, arraste pra coluna destino, solte.
        </Step>
        <Step n={2} title="Status atualiza no banco">
          A mudança é instantânea. Outros vendedores vendo o Kanban veem a movimentação ao recarregar.
        </Step>
      </Section>

      <Section title="Abrir a ficha Lead 360°">
        <Step n={1} title="Clique no cartão">
          Abre a ficha completa do lead.
        </Step>
        <Step n={2} title="Ou navegue por outra rota">
          A Lead 360° também abre pelo Chats (clique no nome do cliente) ou pelo link em alertas do /equipe.
        </Step>
      </Section>

      <HelpImage src="/ajuda/lead360.png" alt="Lead 360°" caption="Lead 360° — KPIs no topo + abas (Timeline, Veículos, Vendas, NPS, Agendamentos, Follow-ups)" />

      <Section title="O que tem na Lead 360°">
        <ul className="space-y-3 text-sm text-gray-700">
          <li>
            <strong>Cabeçalho</strong> — nome, foto WhatsApp, telefone, e-mail, cidade, aniversário, CPF
          </li>
          <li>
            <strong>KPIs</strong> — Score (0-1000), total vendido, NPS médio
          </li>
          <li>
            <strong>Aba Timeline</strong> — eventos cronológicos: mensagens-chave, agendamentos, vendas, NPS, etc
          </li>
          <li>
            <strong>Aba Veículos</strong> — todos os carros do cliente com placa, modelo, ano, KM atual, última
            troca de óleo, último alinhamento, última troca de pneus
          </li>
          <li>
            <strong>Aba Vendas</strong> — histórico de pedidos fechados com data, valor, itens
          </li>
          <li>
            <strong>Aba NPS</strong> — nota dada pelo cliente, categoria (detrator/neutro/promotor), comentário
          </li>
          <li>
            <strong>Aba Agendamentos</strong> — manutenções marcadas, status (confirmado/concluído/cancelado), fonte
            (Max ou manual)
          </li>
          <li>
            <strong>Aba Follow-ups</strong> — mensagens automáticas agendadas (lembrete de troca de óleo, alinhamento
            semestral, aniversário)
          </li>
        </ul>
      </Section>

      <Section title="Lead Score (0-1000)">
        <P>
          Pontuação automática que combina engajamento (responde rápido?) + valor histórico (já comprou?) +
          intenção (pediu preço, marcou avaliação?) + recência. Quanto maior, mais quente o lead. Use pra priorizar
          quem responder primeiro.
        </P>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>🔴 800+ — quente. Fechar agora</li>
          <li>🟠 600-799 — interessado. Follow-up curto</li>
          <li>🟡 400-599 — pesquisando. Nutrir</li>
          <li>🔵 200-399 — frio. Reativação</li>
          <li>⚫ 0-199 — sem sinal</li>
        </ul>
      </Section>

      <Section title="Adicionar nota interna num lead">
        <Step n={1} title="Abra a Lead 360°">
        </Step>
        <Step n={2} title="Campo 'Notas' do cabeçalho">
          Anotações livres — só o time vê. Útil pra histórico tipo &quot;cliente prefere terça à tarde&quot;.
        </Step>
      </Section>

      <Tip>
        Quando dúvida sobre o cliente (já comprou? que carro tem?), abre Lead 360° antes de responder. Ganha contexto
        em 5 segundos e a resposta fica muito mais personalizada.
      </Tip>
    </Article>
  );
}
