/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Sidebar de conversas estilo WhatsApp Web — busca, avatars, preview, unread, score
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Bot, UserCheck, MessageSquare, Mic, Image as ImageIcon, X, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadAvatar } from "@/components/LeadAvatar";

interface Conversation {
  id: string;
  leadId: string;
  name: string | null;
  pushName: string | null;
  avatarUrl: string | null;
  phone: string;
  status: string;
  ownerType: string;
  leadScore: number;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageType: string;
  lastMessageDirection: string;
  assignedAgent?: { id: string; name: string; avatar: string | null } | null;
  assignedUserId?: string | null;
  handoffOpen?: boolean;
}

type FilterTab = "aguardando" | "minhas" | "atendimento" | "todas";

interface ConversationSidebarProps {
  initialConversations: Conversation[];
}

function getInitials(name: string | null, phone: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return phone.slice(-2);
}

function getScoreColor(score: number): string {
  if (score >= 800) return "bg-red-500";
  if (score >= 600) return "bg-orange-500";
  if (score >= 400) return "bg-yellow-500";
  if (score >= 200) return "bg-blue-400";
  return "bg-gray-400";
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) {
    return date.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function getMessagePreview(conv: Conversation): string {
  if (!conv.lastMessageBody) return "Sem mensagens";

  const prefix = conv.lastMessageDirection === "out" ? "Você: " : "";

  if (conv.lastMessageType === "audio") return `${prefix}🎤 Áudio`;
  if (conv.lastMessageType === "image") return `${prefix}📷 Imagem`;
  if (conv.lastMessageType === "video") return `${prefix}🎬 Vídeo`;
  if (conv.lastMessageType === "document") return `${prefix}📄 Documento`;
  if (conv.lastMessageType === "contact") {
    try {
      const parsed = JSON.parse(conv.lastMessageBody);
      if (Array.isArray(parsed) && parsed[0]?.fullName) {
        return `${prefix}📇 ${parsed.map((c: { fullName: string }) => c.fullName).join(", ")}`;
      }
    } catch { /* fallback abaixo */ }
    return `${prefix}📇 Contato`;
  }

  const body = conv.lastMessageBody;
  if (body.startsWith("[Áudio")) return `${prefix}🎤 Áudio`;
  if (body.startsWith("[Imagem")) return `${prefix}📷 Imagem`;
  if (body.startsWith("[Vídeo")) return `${prefix}🎬 Vídeo`;
  if (body.startsWith("[Documento")) return `${prefix}📄 Documento`;

  return `${prefix}${body.length > 50 ? body.slice(0, 50) + "…" : body}`;
}

/**
 * Toca um som curto de notificação usando Web Audio API
 */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio não disponível
  }
}

export default function ConversationSidebar({
  initialConversations,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("todas");
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const prevUnreadMapRef = useRef<Map<string, number>>(new Map());
  const isFirstFetchRef = useRef(true);
  const [toastConv, setToastConv] = useState<Conversation | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Extrai o ID da conversa ativa do pathname
  const activeId = pathname.startsWith("/chats/")
    ? pathname.split("/chats/")[1]?.split("/")[0] ?? null
    : null;

  // Pede permissão de notificação ao montar
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    // Inicializa mapa de unreads com dados iniciais
    const map = new Map<string, number>();
    initialConversations.forEach((c) => map.set(c.id, c.unreadCount));
    prevUnreadMapRef.current = map;
  }, []);

  // Dispara notificação de browser + som + toast in-app
  const fireNotification = useCallback((conv: Conversation) => {
    playNotificationSound();
    const displayName = conv.name || conv.pushName || conv.phone;
    const body = getMessagePreview(conv);

    // Toast in-app
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastConv(conv);
    toastTimerRef.current = setTimeout(() => setToastConv(null), 5000);

    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(`Nova mensagem de ${displayName}`, {
          body,
          icon: conv.avatarUrl || "/assets/logo.png",
          tag: conv.id,
        });
        n.onclick = () => {
          window.focus();
          router.push(`/chats/${conv.id}`);
          n.close();
        };
      } catch {
        // fallback: nada (mobile pode não suportar new Notification)
      }
    }
  }, [router]);

  // Polling para atualizar lista de conversas
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      if (data.conversations) {
        const incoming = data.conversations as Conversation[];

        // Detecta novas mensagens não lidas (pula primeiro fetch)
        if (!isFirstFetchRef.current) {
          const prevMap = prevUnreadMapRef.current;
          for (const conv of incoming) {
            const prevUnread = prevMap.get(conv.id) ?? 0;
            // Notifica se unread subiu E não é a conversa ativa
            if (conv.unreadCount > prevUnread && conv.id !== activeId) {
              fireNotification(conv);
              break; // Notifica só 1 por ciclo para não spammar
            }
          }
        }
        isFirstFetchRef.current = false;

        // Atualiza mapa de unreads
        const newMap = new Map<string, number>();
        incoming.forEach((c) => newMap.set(c.id, c.unreadCount));
        prevUnreadMapRef.current = newMap;

        setConversations(incoming);
      }
    } catch {
      // silently ignore
    }
  }, [activeId, fireNotification]);

  useEffect(() => {
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Atualiza título da aba com contagem de não lidas
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  useEffect(() => {
    document.title = totalUnread > 0
      ? `(${totalUnread}) Conversas — Luma Assistente`
      : "Conversas — Luma Assistente";
    return () => { document.title = "Luma Assistente"; };
  }, [totalUnread]);

  // Conta por aba (independente da busca)
  const tabCounts = useMemo(() => {
    let aguardando = 0;
    let minhas = 0;
    let atendimento = 0;
    for (const c of conversations) {
      const isAguardando = c.handoffOpen && !c.assignedUserId;
      const isMinha = !!currentUserId && c.assignedUserId === currentUserId;
      const isAtendimento = !!c.assignedUserId;
      if (isAguardando) aguardando++;
      if (isMinha) minhas++;
      if (isAtendimento) atendimento++;
    }
    return { aguardando, minhas, atendimento };
  }, [conversations, currentUserId]);

  // Filtra por tab + busca
  const filtered = conversations.filter((c) => {
    // Tab filter
    if (tab === "aguardando" && !(c.handoffOpen && !c.assignedUserId)) return false;
    if (tab === "minhas" && c.assignedUserId !== currentUserId) return false;
    if (tab === "atendimento" && !c.assignedUserId) return false;
    // Busca
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name?.toLowerCase().includes(q)) ||
      (c.pushName?.toLowerCase().includes(q)) ||
      c.phone.includes(q)
    );
  });

  // Ordena: não-lidas primeiro, depois por data
  const sorted = [...filtered].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    return (
      new Date(b.lastMessageAt ?? 0).getTime() -
      new Date(a.lastMessageAt ?? 0).getTime()
    );
  });

  return (
    <>
    <div className={cn(
      "border-r bg-white flex flex-col h-full",
      "w-full md:w-[340px] md:min-w-[340px]",
      activeId ? "hidden md:flex" : "flex"
    )}>
      {/* Header */}
      <div className="px-4 pt-12 md:pt-3 py-3 border-b bg-gray-50/80">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Conversas</h2>
          <span className="text-xs text-gray-500">
            {conversations.length} conversa{conversations.length !== 1 ? "s" : ""}
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-500 transition-colors"
            aria-label="Buscar conversa por nome ou telefone"
          />
        </div>
        {/* Tabs de filtro */}
        <div className="flex flex-wrap gap-1 mt-2 text-[11px]">
          {([
            { id: "todas" as FilterTab, label: "Todas", count: conversations.length },
            { id: "minhas" as FilterTab, label: "Minhas", count: tabCounts.minhas },
            { id: "aguardando" as FilterTab, label: "Aguardando", count: tabCounts.aguardando },
            { id: "atendimento" as FilterTab, label: "Atendimento", count: tabCounts.atendimento },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition",
                tab === t.id
                  ? "bg-[#CC0000] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {t.label}
              {t.count > 0 && <span className="ml-1 opacity-80">({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400 text-center">
              {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
            </p>
          </div>
        )}

        {sorted.map((conv) => {
          const isActive = conv.id === activeId;
          const displayName = conv.name || conv.pushName || conv.phone;

          return (
            <button
              key={conv.id}
              onClick={() => router.push(`/chats/${conv.id}`)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 hover:bg-gray-50",
                isActive && "bg-red-50/80 hover:bg-red-50/80 border-l-2 border-l-red-600"
              )}
              aria-label={`Conversa com ${displayName}`}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <LeadAvatar
                  leadId={conv.leadId}
                  avatarUrl={conv.avatarUrl}
                  name={conv.name || conv.pushName}
                  phone={conv.phone}
                  size="md"
                />
                {/* Owner indicator */}
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white",
                    conv.ownerType === "human" ? "bg-green-500" : "bg-blue-500"
                  )}
                  title={conv.ownerType === "human" ? "Atendimento humano" : "Luma (Bot)"}
                >
                  {conv.ownerType === "human" ? (
                    <UserCheck className="h-2.5 w-2.5 text-white" />
                  ) : (
                    <Bot className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-sm truncate",
                    conv.unreadCount > 0 ? "font-bold text-gray-900" : "font-medium text-gray-800"
                  )}>
                    {displayName}
                  </span>
                  <span className={cn(
                    "text-[11px] flex-shrink-0 ml-2",
                    conv.unreadCount > 0 ? "text-red-600 font-semibold" : "text-gray-400"
                  )}>
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-0.5">
                  <p className={cn(
                    "text-xs truncate pr-2",
                    conv.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-500"
                  )}>
                    {getMessagePreview(conv)}
                  </p>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Lead Score mini badge */}
                    {conv.leadScore > 0 && (
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white",
                          getScoreColor(conv.leadScore)
                        )}
                        title={`Lead Score: ${conv.leadScore}`}
                      >
                        {conv.leadScore}
                      </span>
                    )}

                    {/* Unread badge */}
                    {conv.unreadCount > 0 && (
                      <span className="bg-red-600 text-white text-[10px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Linha do atendente responsável quando humano assumiu */}
                {conv.ownerType === "human" && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-1.5 py-0.5 w-fit max-w-full">
                    <UserCheck className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {conv.assignedAgent?.name
                        ? `Atendido por ${conv.assignedAgent.name}`
                        : "Em atendimento humano"}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>

    {/* Toast de nova mensagem */}
    {(() => {
      const tc = toastConv;
      if (!tc) return null;
      return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 md:bottom-6 z-[70] animate-in slide-in-from-bottom-4 fade-in duration-300 w-[calc(100%-2rem)] max-w-sm">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border border-red-200 bg-white cursor-pointer hover:bg-red-50 transition-colors"
            onClick={() => {
              router.push(`/chats/${tc.id}`);
              setToastConv(null);
            }}
            role="alert"
          >
            <LeadAvatar
              leadId={tc.leadId}
              avatarUrl={tc.avatarUrl}
              name={tc.name || tc.pushName}
              phone={tc.phone}
              size="md"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {tc.name || tc.pushName || tc.phone}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {getMessagePreview(tc)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <MessageCircle className="h-4 w-4 text-red-600" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToastConv(null);
                }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400"
                aria-label="Fechar notificação"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
