/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Article, P, Section, Step, Tip, Note, Warning } from "@/components/ajuda/Article";

export default function UsuariosTutorial() {
  return (
    <Article title="Usuários" subtitle="Cadastrar vendedores, definir roles e gerenciar acessos.">
      <P>
        Página <strong>/users</strong> lista todos usuários da organização. Apenas usuários com role <code>ADMIN</code> ou
        <code> OWNER</code> podem criar/editar.
      </P>

      <Section title="Roles disponíveis">
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-2">
          <li><strong>OWNER</strong> — dono da organização. Não pode ser removido. 1 por organização.</li>
          <li><strong>ADMIN</strong> — pode gerenciar tudo: usuários, settings, knowledge, instâncias</li>
          <li><strong>AGENT</strong> — vendedor. Acessa Chats, Equipe, Agendamentos, Kanban, Lead 360°. NÃO acessa Settings/Usuários</li>
          <li><strong>VIEWER</strong> — apenas leitura. Vê tudo mas não responde nem altera</li>
        </ul>
      </Section>

      <Section title="Criar usuário">
        <Step n={1} title="Clique em 'Novo usuário'">
        </Step>
        <Step n={2} title="Preencha nome, email, senha">
          Email tem que ser único no sistema. Senha mínima 8 caracteres.
        </Step>
        <Step n={3} title="Escolha o role">
          Para vendedores normais, use AGENT. Reserve ADMIN só pra quem precisa configurar.
        </Step>
        <Step n={4} title="Avatar (opcional)">
          URL de imagem ou upload. Aparece no chat /equipe e em handoffs.
        </Step>
        <Step n={5} title="Salvar">
          Usuário recebe acesso imediato. Envie a senha de forma segura (não por WhatsApp em texto).
        </Step>
      </Section>

      <Section title="Resetar senha">
        <Step n={1} title="Localize o usuário na lista">
        </Step>
        <Step n={2} title="Clique em 'Editar' e mude a senha">
          Não tem fluxo de &quot;esqueci minha senha&quot; ainda — admin tem que resetar manualmente.
        </Step>
        <Step n={3} title="Avise o usuário pelo /equipe ou outro canal seguro">
          Peça pra ele entrar e trocar pra uma que só ele saiba.
        </Step>
      </Section>

      <Section title="Desativar (não deletar) usuário">
        <Step n={1} title="Edite o usuário e marque 'Inativo'">
          Inativo não consegue logar mas mantém histórico (mensagens enviadas, vendas feitas, etc).
        </Step>
        <Note>
          Não delete usuários — perderá histórico de quem fez o quê (handoffs, vendas, conversas). Sempre prefira desativar.
        </Note>
      </Section>

      <Section title="Usuário especial 'Luma' (bot)">
        <P>
          O sistema cria automaticamente um usuário com nome &quot;Luma&quot; e role VIEWER quando precisa postar no chat
          /equipe (ex: alertas de handoff, agendamento). Esse usuário tem <code>active: false</code> e por isso NÃO
          aparece na lista de vendedores do PV. É só o avatar do bot dentro do chat interno.
        </P>
        <Warning>
          Não delete o usuário &quot;Luma&quot; — sistema vai recriar mas vai poluir o histórico do /equipe.
        </Warning>
      </Section>

      <Tip>
        Mantenha pelo menos 2 ADMINs. Se o único admin perder acesso, só intervenção direta no banco resolve.
      </Tip>
    </Article>
  );
}
