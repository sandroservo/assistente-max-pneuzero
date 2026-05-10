// Autor: Sandro Servo
// Site: https://cloudservo.com.br
//
// Job de follow-up.
//
// Rodar manualmente: npx tsx scripts/run-followups.ts
//
// Recomendado: rodar via cron a cada 10 minutos:
//   */10 * * * * cd /home/developer/www/assistente-max && \
//     source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && \
//     npx tsx scripts/run-followups.ts >> /var/log/max-followups.log 2>&1

import "dotenv/config";
import {
  processPendingFollowUps,
  scheduleBirthdayFollowUps,
} from "../src/lib/followup-engine";

async function main() {
  console.log(`[${new Date().toISOString()}] Iniciando job de follow-ups`);

  const birthdays = await scheduleBirthdayFollowUps();
  if (birthdays > 0) console.log(`  🎂 ${birthdays} aniversariante(s) agendado(s)`);

  const result = await processPendingFollowUps();
  console.log(
    `  📤 ${result.sent} enviado(s) · ${result.skipped} pulado(s) · ${result.failed} falha(s) [${result.processed} processado(s)]`
  );
  console.log(`[${new Date().toISOString()}] OK`);
}

main()
  .catch((err) => {
    console.error("Job de follow-up falhou:", err);
    process.exit(1);
  })
  .then(() => process.exit(0));
