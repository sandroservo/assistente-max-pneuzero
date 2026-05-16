/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * /equipe — Chat interno do time. Server entry: carrega usuário, passa pro client.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TeamChat } from "./ui/TeamChat";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="h-dvh flex flex-col">
      <TeamChat
        currentUserId={session.user.id}
        currentUserName={session.user.name ?? "Eu"}
      />
    </div>
  );
}
