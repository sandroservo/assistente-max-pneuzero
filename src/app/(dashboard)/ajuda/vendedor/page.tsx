/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 */

import Link from "next/link";
import { Article, P, Section, Tip } from "@/components/ajuda/Article";
import { MessageSquare, MessagesSquare, Calendar, Layout, ArrowRight } from "lucide-react";

export default function VendedorIndex() {
  return (
    <Article title="Visão geral — Vendedor" subtitle="Tudo o que você precisa pra atender clientes no Assistente Luma no dia-a-dia.">
      <P>
        O Luma é o assistente de IA da Pneuzero. Ele recebe mensagens do WhatsApp, responde
        automaticamente baseado no catálogo e na base de conhecimento, e <strong>transfere
        a conversa pra você</strong> quando o cliente pede atendente, quando o pedido vai fechar,
        ou quando ele não tem confiança na resposta.
      </P>

      <Section title="O que você faz no painel">
        <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
          <li>Ler conversas em andamento na <strong>Inbox /chats</strong></li>
          <li>Assumir conversa quando Luma transfere (handoff)</li>
          <li>Marcar agendamentos manualmente em <strong>/agendamentos</strong></li>
          <li>Trocar mensagens com a equipe em <strong>/equipe</strong> (canal Geral + PV)</li>
          <li>Acompanhar lead no Kanban e ver ficha completa em <strong>Lead 360°</strong></li>
        </ul>
      </Section>

      <Section title="Comece pelos 4 tutoriais">
        <div className="grid sm:grid-cols-2 gap-3 not-prose">
          <ShortcutCard href="/ajuda/vendedor/chats" icon={<MessageSquare className="w-5 h-5" />} title="Inbox" desc="Responder, transferir, enviar mídia" />
          <ShortcutCard href="/ajuda/vendedor/equipe" icon={<MessagesSquare className="w-5 h-5" />} title="Chat da equipe" desc="Geral, PV, notificações" />
          <ShortcutCard href="/ajuda/vendedor/agendamentos" icon={<Calendar className="w-5 h-5" />} title="Agendamentos" desc="Marcar, concluir, cancelar" />
          <ShortcutCard href="/ajuda/vendedor/kanban" icon={<Layout className="w-5 h-5" />} title="Kanban & Lead 360°" desc="Mover lead, ver histórico" />
        </div>
      </Section>

      <Tip>
        Quando Luma transfere uma conversa pra humano, todo o time recebe alerta no <strong>canal Geral</strong> do
        /equipe com beep e badge. Mantenha a aba do /equipe aberta enquanto trabalha — você não perde nenhum handoff.
      </Tip>
    </Article>
  );
}

function ShortcutCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="block border border-gray-200 rounded-lg p-4 hover:border-[#CC0000] hover:shadow-sm transition">
      <div className="flex items-center gap-2 text-gray-800 mb-1">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-xs text-gray-500">{desc}</p>
      <p className="text-xs text-[#CC0000] mt-2 inline-flex items-center gap-1">Abrir <ArrowRight className="w-3 h-3" /></p>
    </Link>
  );
}
