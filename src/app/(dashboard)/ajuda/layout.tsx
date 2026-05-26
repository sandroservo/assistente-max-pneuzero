/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Layout da /ajuda — sidebar com índice de artigos por seção (vendedor/admin).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headphones, MessageSquare, MessagesSquare, Calendar, Layout, Settings, BookOpen, Users, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VENDEDOR_NAV: NavItem[] = [
  { href: "/ajuda/vendedor", label: "Visão geral", icon: Home },
  { href: "/ajuda/vendedor/chats", label: "Inbox (Chats)", icon: MessageSquare },
  { href: "/ajuda/vendedor/equipe", label: "Chat interno (/equipe)", icon: MessagesSquare },
  { href: "/ajuda/vendedor/agendamentos", label: "Agendamentos", icon: Calendar },
  { href: "/ajuda/vendedor/kanban", label: "Kanban & Lead 360°", icon: Layout },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/ajuda/admin", label: "Visão geral", icon: Home },
  { href: "/ajuda/admin/settings", label: "Configurações", icon: Settings },
  { href: "/ajuda/admin/knowledge", label: "Base de conhecimento", icon: BookOpen },
  { href: "/ajuda/admin/usuarios", label: "Usuários", icon: Users },
];

export default function AjudaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh bg-gray-50">
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <Link href="/ajuda" className="flex items-center gap-2 p-5 border-b border-gray-100">
          <Headphones className="w-5 h-5 text-[#CC0000]" />
          <span className="font-semibold text-gray-800">Central de Ajuda</span>
        </Link>

        <NavSection title="Vendedor" items={VENDEDOR_NAV} pathname={pathname} />
        <NavSection title="Admin" items={ADMIN_NAV} pathname={pathname} />
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function NavSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div className="px-3 py-4">
      <p className="text-[10px] uppercase tracking-wider font-medium text-gray-400 px-3 mb-2">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/ajuda" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition",
                  active ? "bg-[#CC0000] text-white font-medium" : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
