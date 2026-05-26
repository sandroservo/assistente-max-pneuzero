/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Article, P, Section, Step, Tip, Warning, Checklist } from "@/components/ajuda/Article";

export default function KnowledgeTutorial() {
  return (
    <Article title="Base de conhecimento" subtitle="O que o Max sabe sobre a Pneuzero. Tudo o que ele responde sai daqui.">
      <P>
        A página <strong>/knowledge</strong> é onde você cadastra os fatos que o Max usa pra responder: preços de
        serviços, regras de troca, garantia, endereço, horário, promoções. Sem base, o Max não inventa — recomenda
        transferir pra humano.
      </P>

      <Section title="Estrutura de um item de conhecimento">
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li><strong>Título</strong> — resumo curto (ex: &quot;Garantia de pneus&quot;)</li>
          <li><strong>Conteúdo</strong> — texto completo com a regra/informação</li>
          <li><strong>Tags</strong> — palavras-chave que ajudam o Max a achar (ex: &quot;pneu, garantia, troca&quot;)</li>
          <li><strong>Categoria</strong> — agrupamento (Serviços, Promoções, Endereço, etc)</li>
        </ul>
      </Section>

      <Section title="Como o Max usa a base">
        <Checklist
          items={[
            "Para a 1ª mensagem do lead, Max carrega TODA a base (até 100 itens)",
            "Para mensagens seguintes, Max busca os 25 itens mais relevantes + 60 base + concatena",
            "Toda mensagem do cliente é injetada no contexto OpenAI junto com a base",
            "Sem item relacionado, Max é instruído a NÃO inventar — oferece transferir_humano",
          ]}
        />
      </Section>

      <Section title="Criar item novo">
        <Step n={1} title="Clique em 'Novo item'">
          Modal abre com campos vazios.
        </Step>
        <Step n={2} title="Título curto, conteúdo descritivo">
          Pense como se fosse um FAQ — pergunta e resposta no conteúdo.
        </Step>
        <Step n={3} title="Adicione 3-5 tags">
          Tags ajudam a busca quando a base cresce. Use sinônimos e variantes.
        </Step>
        <Step n={4} title="Categoria">
          Selecione ou crie nova. Útil pra organização interna.
        </Step>
        <Step n={5} title="Salvar">
          Item já entra na próxima busca do Max. Sem restart.
        </Step>
      </Section>

      <Section title="Exemplos de itens valiosos">
        <Checklist
          items={[
            "Endereço, horário de funcionamento, telefones",
            "Lista de serviços com preço base e tempo médio",
            "Garantia de pneus (prazo, condições, exceções)",
            "Política de troca/devolução",
            "Promoções vigentes (com data de validade no conteúdo)",
            "Formas de pagamento (PIX, cartão, parcelado)",
            "Marcas e medidas de pneus que vocês trabalham",
            "Como funciona alinhamento 3D",
            "Diferença entre balanceamento e alinhamento",
          ]}
        />
      </Section>

      <Section title="Importar do CSV">
        <Step n={1} title="Baixe o template CSV em /knowledge → Importar">
          Colunas: title, content, tags (separadas por vírgula), category.
        </Step>
        <Step n={2} title="Preencha em planilha (Excel/Sheets)">
          Mantenha 1 linha por item. Use aspas em campos com vírgula.
        </Step>
        <Step n={3} title="Salve como CSV UTF-8">
          Importante o encoding ser UTF-8 senão acentos quebram.
        </Step>
        <Step n={4} title="Importe">
          Sistema valida cada linha. Erros aparecem na tela com número da linha.
        </Step>
      </Section>

      <Warning>
        Itens com informação contraditória confundem o Max. Se mudar de preço/regra, EDITE o item existente — não crie
        outro. Use Histórico (se disponível) pra ver o que estava antes.
      </Warning>

      <Tip>
        Quando vendedor receber dúvida de cliente que o Max não soube responder, anote o assunto e crie item de
        conhecimento depois. A base melhora com o uso.
      </Tip>
    </Article>
  );
}
