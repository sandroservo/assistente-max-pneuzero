/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Popula FollowUpRule com regras default do Luma/Pneuzero.
 * Rodar: npx tsx scripts/seed-followup-rules.ts
 *
 * Regras documentadas em docs/specs/follow-up-rules.md
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const RULES = [
  {
    tipo: "nps_d1",
    nome: "Pesquisa NPS pós-venda",
    gatilho: JSON.stringify({
      evento: "sale.concluida",
      delayDias: 1,
      horarioEnvio: "14:00",
    }),
    template:
      "Oi {{primeiro_nome}}! Aqui é o Luma da Pneuzero. Ontem você passou aqui pra fazer {{ultimo_servico}} no {{veiculo_modelo}} 🚗\n\nDe 0 a 10, quanto você indicaria a gente pra um amigo?",
  },
  {
    tipo: "alinhamento_3m",
    nome: "Lembrete alinhamento 90 dias",
    gatilho: JSON.stringify({
      evento: "servicelog.tipo=alinhamento",
      delayDias: 90,
      horarioEnvio: "10:00",
    }),
    template:
      "{{primeiro_nome}}, faz 90 dias que você alinhou o {{veiculo_modelo}} aqui na Pneuzero 🛠️\n\nJá tá no momento de uma checagem rápida. Quer que eu agende uma avaliação gratuita?",
  },
  {
    tipo: "rodizio_6m",
    nome: "Lembrete rodízio pneus 6 meses",
    gatilho: JSON.stringify({
      evento: "servicelog.tipo=troca_pneu",
      delayDias: 180,
      horarioEnvio: "10:00",
    }),
    template:
      "Opa {{primeiro_nome}}! Faz 6 meses que você trocou os pneus do {{veiculo_modelo}}. Já tá no ponto de fazer o rodízio pra eles durarem mais 🔄\n\nO rodízio é rapidinho, posso encaixar pra essa semana?",
  },
  {
    tipo: "troca_oleo_km",
    nome: "Lembrete troca óleo (km estimado)",
    gatilho: JSON.stringify({
      evento: "km.atingiu_proxima_troca",
      kmIntervalo: 5000,
      horarioEnvio: "11:00",
    }),
    template:
      "{{primeiro_nome}}, pela média que você roda, o {{veiculo_modelo}} já tá perto dos {{km_estimado}} km da última troca de óleo 🛢️\n\nQuer que eu agende a próxima trocada com a gente? Inclui filtro também.",
  },
  {
    tipo: "aniversario",
    nome: "Aniversário do cliente",
    gatilho: JSON.stringify({
      evento: "lead.birthday",
      horarioEnvio: "09:00",
    }),
    template:
      "Feliz aniversário, {{primeiro_nome}}! 🎂 Te desejamos um ano cheio de saúde e estrada boa.\n\nA Pneuzero tem um presentinho: 10% off em alinhamento ou balanceamento esse mês. Cupom: {{cupom}}\n\nUm abraço da equipe! 🚗",
  },
  {
    tipo: "lead_frio_3d",
    nome: "Reativação lead sem resposta 3 dias",
    gatilho: JSON.stringify({
      evento: "lead.sem_resposta",
      delayDias: 3,
      horarioEnvio: "11:00",
    }),
    template:
      "Oi {{primeiro_nome}}! Aqui é o Luma. Vi que conversamos uns dias atrás sobre pneu pro seu carro 🚗\n\nAinda tá precisando? Se quiser, posso reservar uma avaliação gratuita aqui na loja. Sem compromisso!",
  },
  {
    tipo: "lead_frio_15d",
    nome: "Reativação lead frio 15 dias",
    gatilho: JSON.stringify({
      evento: "lead.status=LEAD_FRIO",
      delayDias: 15,
      horarioEnvio: "16:00",
    }),
    template:
      "{{primeiro_nome}}, passando rapidinho! Surgiu uma condição boa esse mês em alinhamento + balanceamento + rodízio: pacote completo por preço de promoção.\n\nQuer que eu te envie os detalhes? 🛠️",
  },
  {
    tipo: "garantia_vencendo",
    nome: "Aviso garantia próxima vencer",
    gatilho: JSON.stringify({
      evento: "servicelog.garantia_ate",
      delayDias: -7,
      horarioEnvio: "10:00",
    }),
    template:
      "{{primeiro_nome}}, a garantia do serviço de {{ultimo_servico}} no {{veiculo_modelo}} vence em 7 dias.\n\nSe sentir algo estranho, passa aqui pra gente avaliar — ainda dá tempo de cobrir pela garantia 🛡️",
  },
];

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.error("❌ Nenhuma organização encontrada. Rode seed-admin primeiro.");
    process.exit(1);
  }

  console.log(`Organização: ${org.name} (${org.id})`);

  let created = 0;
  let updated = 0;

  for (const rule of RULES) {
    const existing = await prisma.followUpRule.findUnique({
      where: { organizationId_tipo: { organizationId: org.id, tipo: rule.tipo } },
    });

    if (existing) {
      await prisma.followUpRule.update({
        where: { id: existing.id },
        data: {
          nome: rule.nome,
          gatilho: rule.gatilho,
          template: rule.template,
        },
      });
      console.log(`  ↻  ${rule.tipo} atualizada`);
      updated++;
    } else {
      await prisma.followUpRule.create({
        data: {
          organizationId: org.id,
          tipo: rule.tipo,
          nome: rule.nome,
          gatilho: rule.gatilho,
          template: rule.template,
        },
      });
      console.log(`  ✅ ${rule.tipo} criada`);
      created++;
    }
  }

  console.log(`\nResultado: ${created} criadas, ${updated} atualizadas`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
