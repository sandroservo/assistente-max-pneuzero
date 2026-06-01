/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import Link from "next/link";
import { Article, P, Section, Warning } from "@/components/ajuda/Article";
import { Settings, BookOpen, Users, ArrowRight } from "lucide-react";

export default function AdminIndex() {
  return (
    <Article title="Visão geral — Admin" subtitle="Configurar o sistema, alimentar o conhecimento do Luma e gerenciar usuários.">
      <P>
        Como admin você configura integrações (WhatsApp via Evolution + OpenAI), alimenta a base de conhecimento que o
        Luma consulta, define o prompt do assistente, gerencia usuários (vendedores), tags do Kanban e regras de follow-up.
      </P>

      <Warning>
        Alterações em Configurações (especialmente system_prompt, tokens Evolution e OpenAI) afetam imediatamente o
        comportamento do Luma em produção. Faça backup do prompt atual antes de mudanças grandes.
      </Warning>

      <Section title="Áreas administrativas">
        <div className="grid sm:grid-cols-3 gap-3 not-prose">
          <Card href="/ajuda/admin/settings" icon={<Settings className="w-5 h-5" />} title="Configurações" desc="OpenAI, Evolution, prompt do Luma" />
          <Card href="/ajuda/admin/knowledge" icon={<BookOpen className="w-5 h-5" />} title="Conhecimento" desc="Base que o Luma consulta" />
          <Card href="/ajuda/admin/usuarios" icon={<Users className="w-5 h-5" />} title="Usuários" desc="Vendedores, roles, senhas" />
        </div>
      </Section>

      <Section title="Checklist inicial (instalação nova)">
        <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
          <li>Cadastrar usuários (admin + vendedores) em /users</li>
          <li>Configurar tokens OpenAI e Evolution em /settings</li>
          <li>Conectar instância WhatsApp (QR code) em /settings &gt; Instâncias</li>
          <li>Alimentar base de conhecimento em /knowledge (preços, regras, endereços)</li>
          <li>Revisar system_prompt do Luma em /settings &gt; Prompt</li>
          <li>Testar mandando uma mensagem do seu celular pro número conectado</li>
        </ol>
      </Section>
    </Article>
  );
}

function Card({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="block border border-gray-200 rounded-lg p-4 hover:border-[#CC0000] hover:shadow-sm transition">
      <div className="flex items-center gap-2 text-gray-800 mb-1">{icon}<span className="font-medium">{title}</span></div>
      <p className="text-xs text-gray-500">{desc}</p>
      <p className="text-xs text-[#CC0000] mt-2 inline-flex items-center gap-1">Abrir <ArrowRight className="w-3 h-3" /></p>
    </Link>
  );
}
