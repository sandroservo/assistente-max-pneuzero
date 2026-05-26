/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Wrappers de UI pros artigos da /ajuda. Sem MDX — componentes TSX puros.
 */

import type { ReactNode } from "react";
import { CheckCircle2, Info, Lightbulb, AlertTriangle, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export function Article({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <article className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-8 border-b border-gray-100 pb-4">
        <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-2 text-gray-500">{subtitle}</p>}
      </header>
      <div className="prose prose-gray max-w-none space-y-4 text-gray-800">{children}</div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-gray-700">{children}</p>;
}

export function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <div className="flex gap-3 my-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[#CC0000] text-white text-sm font-semibold flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{title}</p>
        {children && <div className="text-sm text-gray-600 mt-1 space-y-1">{children}</div>}
      </div>
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <Callout icon={<Lightbulb className="w-4 h-4" />} className="bg-amber-50 text-amber-900 border-amber-200">
      <strong className="font-semibold">Dica:</strong> {children}
    </Callout>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <Callout icon={<Info className="w-4 h-4" />} className="bg-blue-50 text-blue-900 border-blue-200">
      <strong className="font-semibold">Nota:</strong> {children}
    </Callout>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <Callout icon={<AlertTriangle className="w-4 h-4" />} className="bg-red-50 text-red-900 border-red-200">
      <strong className="font-semibold">Atenção:</strong> {children}
    </Callout>
  );
}

function Callout({ icon, className, children }: { icon: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex gap-2 items-start border rounded-lg p-3 text-sm", className)}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function Cmd({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-gray-900 text-gray-100 rounded-lg px-3 py-2 font-mono text-sm overflow-x-auto">
      <Terminal className="w-4 h-4 shrink-0 text-gray-400" />
      <code>{children}</code>
    </div>
  );
}

export function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 my-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 text-xs font-mono bg-gray-100 border border-gray-300 rounded shadow-sm text-gray-800">
      {children}
    </kbd>
  );
}

export function ImagePlaceholder({ caption }: { caption?: string }) {
  return (
    <figure className="my-4 border border-dashed border-gray-300 rounded-lg p-8 bg-gray-50 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wider">Screenshot</p>
      {caption && <p className="text-sm text-gray-700 mt-2">{caption}</p>}
    </figure>
  );
}

/**
 * Screenshot real capturado por scripts/capture-help-screens.ts.
 * Path padrão: /ajuda/<slug>.png (servido de /public/ajuda).
 * Se o arquivo não existir, renderiza fallback elegante (não quebra a página).
 */
export function HelpImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-5">
      <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="block w-full h-auto"
          onError={(e) => {
            const img = e.currentTarget;
            img.style.display = "none";
            const parent = img.parentElement;
            if (parent && !parent.querySelector("[data-fallback]")) {
              const fb = document.createElement("div");
              fb.setAttribute("data-fallback", "true");
              fb.className = "p-8 text-center text-sm text-gray-500";
              fb.textContent = "Screenshot ainda não disponível — rode scripts/capture-help-screens.ts";
              parent.appendChild(fb);
            }
          }}
        />
      </div>
      {caption && <figcaption className="text-xs text-gray-500 text-center mt-2 italic">{caption}</figcaption>}
    </figure>
  );
}
