/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * /agendamentos — lista todos agendamentos do mês corrente, filtros e criar manual.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AgendamentosClient } from "./ui/AgendamentosClient";

export const dynamic = "force-dynamic";

export default async function AgendamentosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <AgendamentosClient />;
}
