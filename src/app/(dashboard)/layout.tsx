/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationProvider } from "@/components/NotificationProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      <NotificationProvider />
    </div>
  );
}
