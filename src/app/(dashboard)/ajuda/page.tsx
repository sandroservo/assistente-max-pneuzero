/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * /ajuda — landing com cards para Vendedor e Admin.
 */

import Link from "next/link";
import { Headphones, ArrowRight, ShieldCheck } from "lucide-react";

export default function AjudaIndex() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <header className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#CC0000]/10 mb-4">
          <Headphones className="w-7 h-7 text-[#CC0000]" />
        </div>
        <h1 className="text-3xl font-semibold text-gray-900">Central de Ajuda</h1>
        <p className="mt-3 text-gray-500 max-w-xl mx-auto">
          Tutoriais passo a passo para usar o Assistente Max. Escolha o seu perfil abaixo.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <Card
          href="/ajuda/vendedor"
          icon={<Headphones className="w-6 h-6 text-emerald-700" />}
          tone="bg-emerald-50 border-emerald-100"
          title="Vendedor"
          desc="Atender clientes no WhatsApp, transferir conversas, marcar agendamentos e usar o chat interno do time."
        />
        <Card
          href="/ajuda/admin"
          icon={<ShieldCheck className="w-6 h-6 text-blue-700" />}
          tone="bg-blue-50 border-blue-100"
          title="Admin"
          desc="Configurar integrações Evolution/OpenAI, gerenciar usuários, alimentar a base de conhecimento e ajustar o prompt do Max."
        />
      </div>

      <p className="text-center text-xs text-gray-400 mt-10">
        Os atalhos do menu lateral ficam sempre visíveis dentro da /ajuda.
      </p>
    </div>
  );
}

function Card({ href, icon, tone, title, desc }: { href: string; icon: React.ReactNode; tone: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border ${tone} p-6 hover:shadow-md transition`}
    >
      <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center mb-4 shadow-sm">
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{desc}</p>
      <p className="mt-4 inline-flex items-center text-sm font-medium text-gray-800 group-hover:gap-2 gap-1 transition-all">
        Ver tutoriais <ArrowRight className="w-4 h-4" />
      </p>
    </Link>
  );
}
