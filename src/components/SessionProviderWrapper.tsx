/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Wrapper client do SessionProvider do NextAuth. Necessário pra useSession()
 * funcionar em components client dentro do layout do dashboard.
 */

"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
