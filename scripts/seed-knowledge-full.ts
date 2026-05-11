/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Script para popular base de conhecimento da Pneuzero
 * Executar com: npx tsx scripts/seed-knowledge-full.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const KNOWLEDGE_DATA = [
  // === ROTEIRO DE ATENDIMENTO ===
  {
    category: "roteiro",
    title: "Roteiro Completo — Atendimento Virtual Pneuzero",
    content: `ROTEIRO DE MENSAGEM – ATENDIMENTO VIRTUAL (FOCO EM VALOR)

ORDEM OFICIAL DO ATENDIMENTO:

Resposta 1 – Composição inicial:
Oi! Tudo bem? Claro, te ajudo sim! Só pra eu montar certinho pra você: vai trocar quantos pneus? E pretende alinhar e balancear o carro com a gente?

Resposta 2 – Ganho de tempo + ano do veículo:
Perfeito! Já estou vendo aqui uma condição boa, já considerando os serviços. Aproveitando, me fala só o ano do veículo, por favor.

Resposta 3 – CHECKLIST + QUILOMETRAGEM:
Aqui você deve enviar UMA das mensagens de checklist, escolhendo a opção que corresponde à idade do carro informada pelo cliente (ver base de conhecimento "Checklist por Idade do Veículo").

Resposta 4 – Preço (já ajustado):
Sobre o pneu [medida], ficou assim: Pneu [marca/modelo] — R$ XXX cada. Montagem grátis, bicos grátis, alinhamento e balanceamento inclusos.

Resposta 5 – Forma de pagamento:
Pra te ajudar a escolher a melhor condição, você pretende pagar à vista ou parcelado no cartão? Dependendo da forma de pagamento, consigo melhorar um pouco o valor.

Resposta 6 – Fechamento:
Qualquer coisa, pode trazer o carro sem compromisso. A gente faz uma avaliação gratuita e te orienta certinho. Aqui na Pneu Zero você resolve tudo em um só lugar: pneus, alinhamento, suspensão, freios, óleo, elétrica e baterias.

IMPORTANTE: Siga essa ordem naturalmente. Adapte o tom conforme a conversa. Não precisa ser robótico — seja consultivo e amigável.`,
    keywords: "roteiro, atendimento, ordem, composição, pneu, alinhar, balancear, preço, pagamento, fechamento",
    priority: 10,
  },
  // === CHECKLIST POR IDADE DO VEÍCULO ===
  {
    category: "checklist",
    title: "Checklist — Veículo NOVO (Até 1 ano)",
    content: `Modelo de checklist para veículos com até 1 ano de uso:

Só como orientação, todo veículo precisa verificar anualmente, em média:
• Pneus & Geometria: Calibragem mensal, alinhamento/balanceamento (3 meses) e rodízio (6 meses).
• Conforto: Limpeza do ar-condicionado (6 meses) e palhetas do limpador (anual).

Nesse primeiro período, os demais itens costumam variar conforme o uso do veículo. Pela quilometragem do carro fica ainda mais fácil identificar certinho o que já está no prazo. Se souber me informar, eu confiro isso pra você também.

QUANDO USAR: Quando o cliente informar que o veículo tem até 1 ano de uso.`,
    keywords: "checklist, novo, 1 ano, veículo novo, carro novo, recente, zero km, calibragem, rodízio",
    priority: 9,
  },
  {
    category: "checklist",
    title: "Checklist — Veículo de ~2 anos",
    content: `Modelo de checklist para veículos com aproximadamente 2 anos de uso:

Só como orientação, todo veículo precisa verificar anualmente, em média:
• Pneus & Geometria: Calibragem, alinhamento/balanceamento (3 meses) e rodízio (6 meses).
• Conforto: Limpeza do ar-condicionado e palhetas do limpador.

E em veículos em torno de 2 anos, normalmente já vale observar também:
• Elétrica & Fluidos: Teste de bateria, troca de óleo/filtros, parte elétrica, fluido de freio e filtro de combustível.
• Mecânica: Verificação de buchas e bieletas.

Pela quilometragem do carro fica ainda mais fácil identificar certinho o que já está no prazo. Se souber me informar, eu confiro isso pra você também.

QUANDO USAR: Quando o cliente informar que o veículo tem aproximadamente 2 anos de uso.`,
    keywords: "checklist, 2 anos, dois anos, bateria, óleo, filtro, bucha, bieleta",
    priority: 9,
  },
  {
    category: "checklist",
    title: "Checklist — Veículo de ~4 anos",
    content: `Modelo de checklist para veículos com aproximadamente 4 anos de uso:

Só como orientação, todo veículo precisa verificar anualmente, em média:
• Pneus & Geometria: Calibragem, alinhamento/balanceamento e rodízio.
• Conforto: Limpeza do ar-condicionado e palhetas.

Em veículos em torno de 4 anos, além dos itens anteriores, observamos:
• Elétrica & Fluidos: Bateria, óleo/filtros, parte elétrica, fluido de freio e filtro de combustível.
• Motor & Câmbio: Verificação das velas de ignição e fluido de câmbio (dependendo do modelo).
• Mecânica: Verificação de buchas e bieletas.

Pela quilometragem do carro fica ainda mais fácil identificar certinho o que já está no prazo. Se souber me informar, eu confiro isso pra você também.

QUANDO USAR: Quando o cliente informar que o veículo tem aproximadamente 4 anos de uso.`,
    keywords: "checklist, 4 anos, quatro anos, vela, ignição, câmbio, fluido",
    priority: 9,
  },
  {
    category: "checklist",
    title: "Checklist — Veículo de ~6 anos",
    content: `Modelo de checklist para veículos com aproximadamente 6 anos de uso:

Só como orientação, todo veículo precisa verificar anualmente, em média:
• Pneus & Geometria: Calibragem, alinhamento/balanceamento e rodízio.
• Conforto: Limpeza do ar-condicionado e palhetas.

Em veículos em torno de 6 anos, além dos ciclos anteriores, observamos:
• Elétrica & Fluidos: Bateria, óleo/filtros, fluido de freio e filtro de combustível.
• Motor & Câmbio: Verificação das velas de ignição e fluido de câmbio.
• Suspensão & Freios: Verificação de amortecedores, sistema de freios, buchas, bieletas e pivôs.

Pela quilometragem do carro fica ainda mais fácil identificar certinho o que já está no prazo. Se souber me informar, eu confiro isso pra você também.

QUANDO USAR: Quando o cliente informar que o veículo tem aproximadamente 6 anos de uso.`,
    keywords: "checklist, 6 anos, seis anos, amortecedor, freio, pivô, suspensão",
    priority: 9,
  },
  {
    category: "checklist",
    title: "Checklist — Veículo de 8 anos ou mais",
    content: `Modelo de checklist para veículos com 8 anos ou mais de uso:

Só como orientação, todo veículo precisa verificar anualmente, em média:
• Pneus & Geometria: Calibragem, alinhamento/balanceamento e rodízio.
• Conforto: Limpeza do ar-condicionado e palhetas.

Em veículos com 8 anos ou mais, o cuidado deve ser preventivo total:
• Elétrica & Fluidos: Bateria, óleo/filtros, fluido de freio e filtro de combustível.
• Motor & Câmbio: Velas de ignição e fluido de câmbio.
• Suspensão & Freios: Revisão completa da suspensão e do sistema de freios.
• Geral: Monitoramento de possíveis vazamentos e buchas/pivôs.

Pela quilometragem do carro fica ainda mais fácil identificar certinho o que já está no prazo. Se souber me informar, eu confiro isso pra você também.

QUANDO USAR: Quando o cliente informar que o veículo tem 8 anos ou mais de uso.`,
    keywords: "checklist, 8 anos, oito anos, antigo, velho, vazamento, revisão completa, preventivo total",
    priority: 9,
  },

  // === SERVIÇOS ===
  {
    category: "servicos",
    title: "Serviços Oferecidos — Pneu Zero",
    content: `A Pneu Zero oferece os seguintes serviços:

• Pneus — venda e montagem de pneus de todas as medidas
• Alinhamento — alinhamento computadorizado
• Balanceamento — balanceamento de rodas
• Suspensão — revisão e reparo de suspensão (amortecedores, buchas, bieletas, pivôs)
• Freios — revisão e troca de pastilhas, discos e fluido de freio
• Óleo — troca de óleo e filtros
• Elétrica — serviços de elétrica automotiva
• Baterias — venda e instalação de baterias

Diferenciais:
• Montagem grátis na compra de pneus
• Bicos grátis
• Alinhamento e balanceamento inclusos na compra de pneus
• Avaliação gratuita sem compromisso`,
    keywords: "serviços, o que faz, pneu, alinhamento, balanceamento, suspensão, freio, óleo, elétrica, bateria, montagem, bico",
    priority: 10,
  },

  // === PAGAMENTO ===
  {
    category: "pagamento",
    title: "Formas de Pagamento — Pneu Zero",
    content: `Formas de pagamento aceitas:
• À vista (dinheiro, Pix, débito) — possibilidade de desconto adicional
• Cartão de crédito — parcelamento disponível

IMPORTANTE: Dependendo da forma de pagamento, o Max pode oferecer melhorar o valor. Sempre perguntar ao cliente se prefere à vista ou parcelado antes de dar o preço final.`,
    keywords: "pagamento, pix, cartão, crédito, débito, à vista, parcelado, parcela, desconto, forma de pagamento",
    priority: 9,
  },

  // === ATENDIMENTO ===
  {
    category: "atendimento",
    title: "Sobre a Pneu Zero",
    content: `A Pneu Zero é uma loja especializada em pneus e serviços automotivos.

Aqui na Pneu Zero o cliente resolve tudo em um só lugar: pneus, alinhamento, suspensão, freios, óleo, elétrica e baterias.

Diferenciais:
• Atendimento consultivo — ajudamos o cliente a entender o que o carro precisa
• Checklist gratuito por idade do veículo — orientação sobre itens de manutenção
• Avaliação sem compromisso — o cliente pode trazer o carro para avaliação gratuita
• Preço competitivo — montagem, bicos, alinhamento e balanceamento inclusos na compra de pneus`,
    keywords: "pneu zero, pneuzero, quem somos, sobre, loja, empresa, o que é",
    priority: 10,
  },
  {
    category: "atendimento",
    title: "Avaliação Gratuita",
    content: `A Pneu Zero oferece avaliação gratuita sem compromisso.

O cliente pode trazer o carro e a equipe faz uma avaliação completa, orientando sobre o que precisa de atenção imediata e o que pode esperar.

Usar como argumento de fechamento:
"Qualquer coisa, pode trazer o carro sem compromisso. A gente faz uma avaliação gratuita e te orienta certinho."`,
    keywords: "avaliação, gratuita, sem compromisso, trazer o carro, avaliar, verificar",
    priority: 8,
  },

  // === FAQ ===
  {
    category: "faq",
    title: "Perguntas Frequentes — Pneu Zero",
    content: `Perguntas comuns dos clientes:

"Quanto custa o pneu?"
→ Perguntar a medida do pneu antes de responder. Se o cliente não souber, pedir ano/modelo do veículo.

"Vocês fazem alinhamento?"
→ Sim! Alinhamento computadorizado. E na compra de pneus, o alinhamento e balanceamento são inclusos.

"Qual pneu é melhor pro meu carro?"
→ Perguntar uso do veículo (cidade, estrada, misto) e preferência (durabilidade, conforto, performance).

"Demora quanto tempo?"
→ Troca de pneus + alinhamento + balanceamento: em média 40 min a 1h.

"Tem garantia?"
→ Os pneus têm garantia do fabricante. Os serviços têm garantia da loja.

"Aceitam cartão?"
→ Sim! À vista (Pix, débito, dinheiro) ou parcelado no cartão de crédito.`,
    keywords: "perguntas, frequentes, dúvida, quanto custa, demora, garantia, cartão, qual pneu, medida",
    priority: 8,
  },

  // === CATÁLOGO DE PNEUS (preços oficiais) ===
  {
    category: "pneus",
    title: "Catálogo de Pneus — Pneuzero (preços a partir de)",
    content: `Pneus em estoque e seus preços oficiais (a partir de):

XBRI 185/60R15 — Carro de passeio aro 15 — A PARTIR DE R$ 409,90
XBRI 265/60R18 A/T — SUV/caminhonete aro 18 (uso misto/trilha) — A PARTIR DE R$ 1.199,90
XBRI 265/60R18 H/T — SUV/caminhonete aro 18 (rodovia) — A PARTIR DE R$ 1.159,90
A/T 265/65R17 — SUV/caminhonete aro 17 (uso misto) — A PARTIR DE R$ 935,00
A/T 265/70R16 — SUV/caminhonete aro 16 (uso misto) — A PARTIR DE R$ 968,90

OBSERVAÇÕES:
• Valores "a partir de" — podem variar conforme marca/modelo escolhido.
• Sempre confirmar disponibilidade em estoque.
• Outras marcas e medidas: consultar a equipe (Pirelli, Michelin, Goodyear etc. podem estar em estoque sob demanda).

DIFERENCIAL: Montagem grátis, bicos grátis, alinhamento e balanceamento podem entrar nos kits promocionais (ver Knowledge "Kits Promocionais").`,
    keywords: "pneu, pneus, xbri, aro 15, aro 16, aro 17, aro 18, 185/60r15, 265/60r18, 265/65r17, 265/70r16, a/t, h/t, suv, caminhonete, preço pneu, valor pneu",
    priority: 10,
  },

  // === KITS PROMOCIONAIS ===
  {
    category: "promocoes",
    title: "Kits Promocionais — Combos com pneu + alinhamento + balanceamento",
    content: `KITS PROMOCIONAIS PNEUZERO (parcelados no cartão):

🏆 KIT KING
• 2 Pneus + Alinhamento + Balanceamento
• 10x de R$ 149,80 SEM JUROS (total R$ 1.498,00)
• Indicado para troca dos 2 dianteiros (ou traseiros)

🚗 KIT MINI
• 4 Pneus + Alinhamento + Balanceamento
• 10x de R$ 239,00 (total R$ 2.390,00)
• Indicado para troca completa de carros de passeio

🛻 KIT L200
• 4 Pneus na medida 265/70 R16 + Alinhamento + Balanceamento
• 10x de R$ 365,99 (total R$ 3.659,90)
• Específico para Mitsubishi L200 e similares

QUANDO OFERECER:
• Cliente pediu cotação de 2 ou 4 pneus → ofereça o KIT correspondente (KING para 2, MINI para 4).
• Cliente tem L200, Triton, Hilux ou outra picape → KIT L200 ou MINI conforme medida.
• SEMPRE mencione que o kit já INCLUI alinhamento e balanceamento (vantagem que o cliente percebe).
• Parcelamento sujeito à aprovação do cartão.`,
    keywords: "kit, kit king, kit mini, kit l200, combo, promoção, parcelado, 10x, 2 pneus, 4 pneus, l200, triton, hilux, picape",
    priority: 10,
  },

  // === PROMOÇÕES INDIVIDUAIS ===
  {
    category: "promocoes",
    title: "Promoções Ativas — Freios e Óleo",
    content: `PROMOÇÕES ATIVAS:

🛑 TROCA DE PASTILHA DE FREIO — R$ 179,90 (promocional)
• Inclui mão de obra. Pastilhas variam conforme modelo.
• Garantia de 90 dias na mão de obra.

🛢️ TROCA DE ÓLEO PARA CARRO DE PASSEIO
• Produto: HEXLUB Ecopower
• A PARTIR DE R$ 150,00
• Inclui filtro de óleo.

🛻 TROCA DE ÓLEO PARA CAMINHONETE / SUV
• Produto: HEXLUB Massive 5W30
• A PARTIR DE R$ 378,90
• Inclui filtro de óleo.

QUANDO USAR:
• Cliente perguntar valor de pastilha → cite a promoção R$ 179,90.
• Cliente disse "preciso trocar óleo" + carro de passeio → HEXLUB Ecopower R$ 150.
• Cliente disse "preciso trocar óleo" + caminhonete/SUV → HEXLUB Massive R$ 378,90.
• Sempre confirmar modelo do veículo antes de fechar valor.`,
    keywords: "promoção, pastilha, freio, R$ 179, óleo, óleo carro, óleo caminhonete, hexlub, ecopower, massive, 5w30",
    priority: 9,
  },

  // === PREÇOS DE SERVIÇOS AVULSOS ===
  {
    category: "servicos",
    title: "Tabela de Preços — Serviços Automotivos (a partir de)",
    content: `PREÇOS BASE DE SERVIÇOS PNEUZERO (a partir de):

PNEUS & GEOMETRIA
• Alinhamento e Balanceamento (carro de passeio): A PARTIR DE R$ 80,00 (garantia 90 dias)

ÓLEO & FILTROS
• Troca de Óleo: A PARTIR DE R$ 50,00 (mão de obra; produto à parte)

FREIOS
• Troca de Pastilha: A PARTIR DE R$ 50,00 (promoção R$ 179,90 — ver promoções)

MOTOR & TRANSMISSÃO
• Troca de Correias: A PARTIR DE R$ 70,00
• Serviço de Kit de Embreagem: A PARTIR DE R$ 350,00
• Troca de Junta Homocinética: A PARTIR DE R$ 60,00

ELÉTRICA
• Serviço de Injeção Eletrônica: A PARTIR DE R$ 120,00 (indicado quando há luzes acesas no painel)

SUSPENSÃO & DIREÇÃO
• Troca de Pivô: A PARTIR DE R$ 50,00
• Troca de Terminal: A PARTIR DE R$ 30,00
• Troca de Rolamento da Roda: A PARTIR DE R$ 70,00

OUTROS
• Troca de Reservatório de Água: A PARTIR DE R$ 70,00

OBSERVAÇÕES:
• Valores "a partir de" — variam conforme modelo do veículo.
• Sempre pedir modelo + ano antes de confirmar preço final.
• Parcelamentos sujeitos à aprovação.`,
    keywords: "preço, valor, serviço, alinhamento, balanceamento, óleo, pastilha, correia, embreagem, junta, homocinética, injeção, pivô, terminal, rolamento, reservatório, tabela",
    priority: 10,
  },

  // === REGRAS DO MAX ===
  {
    category: "empresa",
    title: "Pneu Zero — Quem somos, onde estamos, como contatar",
    content: `Pneu Zero Maranhão — "Qualidade que Move o Seu Dia"

QUEM SOMOS:
Desde 1980, a Pneu Zero é líder em soluções automotivas no Maranhão. Empresa familiar tradicional, especialista em pneus e serviços automotivos com foco em qualidade, atendimento personalizado e inovação constante.

ENDEREÇO (Matriz - Entroncamento):
BR-010, 3441 — Entroncamento
Imperatriz - MA — CEP: 65.913-460

TELEFONES:
- Vendas / Agendamento: (99) 99145-8080 e (99) 3071-2591
- Financeiro: (99) 99196-8080
- SAC: (99) 98406-9097

E-MAIL: pneuzeroitz@gmail.com
INSTAGRAM: @pneuzeromaranhao

DIFERENCIAIS:
• Agilidade no serviço — atendimentos rápidos e eficientes
• Variedade de produtos — grande estoque de pneus e lubrificantes
• Profissionais qualificados — equipe técnica altamente capacitada
• Décadas de experiência no mercado

QUANDO USAR: Quando o cliente perguntar sobre endereço, telefone, horário, onde fica, como entrar em contato, há quanto tempo existe a empresa, ou pedir informações institucionais.`,
    keywords: "endereço, telefone, contato, onde fica, imperatriz, maranhão, br-010, entroncamento, sac, vendas, financeiro, email, instagram, desde quando, história, empresa",
    priority: 10,
  },
  {
    category: "servicos",
    title: "Serviços Oferecidos na Pneu Zero",
    content: `Serviços disponíveis na Pneu Zero (catálogo oficial do site pneuzeromaranhao.com.br):

1. VENDA DE PNEUS E ACESSÓRIOS
Ampla seleção de pneus e acessórios automotivos. Atende carros de passeio, SUV e utilitários.

2. TROCA DE ÓLEO E FILTROS
Produtos de alta qualidade para o motor. Inclui filtro de óleo, filtro de ar e troca de fluidos conforme o manual do veículo. Duração média: 30 min.

3. ALINHAMENTO
Ajustes precisos para uma direção mais segura. Corrige convergência, cambagem e cáster, evitando desgaste irregular dos pneus. Duração média: 45 min. Garantia: 90 dias.

4. BALANCEAMENTO
Garante a estabilidade e o conforto do veículo. Equilibra peso da roda + pneu para eliminar vibrações. Duração média: 30 min. Garantia: 90 dias.

5. SERVIÇOS DE SUSPENSÃO
Avaliação e troca de amortecedores, molas, batentes, buchas e bieletas. Duração média: 2 horas.

6. SISTEMA DE FREIOS
Manutenções preventivas e corretivas. Troca de pastilhas, discos, lonas, fluido de freio e revisão completa do sistema. Duração média: 1h30.

DICA AO MAX: A Pneu Zero é uma loja completa — o cliente resolve tudo em um lugar só. Sempre lembre essa vantagem na conversa.`,
    keywords: "serviços, pneus, alinhamento, balanceamento, suspensão, freios, óleo, filtros, catálogo, o que oferece, garantia, duração",
    priority: 10,
  },
  {
    category: "regras",
    title: "Regras de Ouro do Max — Atendimento Consultivo",
    content: `Regras que o Max DEVE seguir sempre:

1. NUNCA empurre venda — ajude o cliente a entender o que o carro precisa
2. SEMPRE pergunte a quantidade de pneus e se quer alinhamento/balanceamento antes de passar preço
3. SEMPRE pergunte o ano do veículo para enviar o checklist correto
4. Após o checklist, pergunte a quilometragem se possível
5. Passe o preço já com montagem, bicos, alinhamento e balanceamento inclusos
6. Pergunte a forma de pagamento ANTES de fechar — pode oferecer condição melhor
7. Use o fechamento consultivo: "pode trazer o carro sem compromisso"
8. Se não sabe o preço de um pneu específico, NÃO invente — diga que vai verificar
9. Seja amigável e natural, como um consultor de confiança
10. SEMPRE reaja ao que o cliente disse antes de fazer a próxima pergunta

Frases que o Max PODE usar:
- "Claro, te ajudo sim!"
- "Já estou vendo aqui uma condição boa pra você"
- "Só como orientação..."
- "Pela quilometragem do carro fica mais fácil identificar..."
- "Pode trazer o carro sem compromisso"
- "Aqui na Pneu Zero você resolve tudo em um só lugar"

Frases que o Max NUNCA deve usar:
- Preços inventados
- "Não sei" sem oferecer alternativa
- Linguagem muito formal ou robótica`,
    keywords: "regras, atendimento, como atender, tom, estilo, frases, abordagem, consultivo",
    priority: 10,
  },
];

/**
 * Seed único: apaga a base de conhecimento e insere na organização (single-tenant).
 * Executar: npx tsx scripts/seed-knowledge-full.ts
 */
export async function main() {
  let org = await prisma.organization.findFirst({ orderBy: { name: "asc" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Pneu Zero", slug: "pneuzero" },
    });
    console.log(`Organização criada: ${org.name} (${org.slug})`);
  }

  console.log(`Apagando base de conhecimento antiga...`);
  await prisma.knowledge.deleteMany({});

  console.log(`Inserindo ${KNOWLEDGE_DATA.length} conhecimentos em ${org.name}...\n`);

  for (const item of KNOWLEDGE_DATA) {
    await prisma.knowledge.create({
      data: {
        ...item,
        organizationId: org.id,
      },
    });
    console.log(`  ✓ [${item.category}] ${item.title}`);
  }

  console.log(`\n✅ Concluído: ${KNOWLEDGE_DATA.length} conhecimentos.`);
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
