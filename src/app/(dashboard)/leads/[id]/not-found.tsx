import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LeadNotFound() {
  return (
    <div className="p-6 pt-14 md:pt-6">
      <div className="mb-4">
        <Link href="/leads" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Voltar para leads
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center max-w-md mx-auto mt-12">
        <h1 className="text-4xl font-bold text-[#CC0000]">Lead não encontrado</h1>
        <p className="mt-3 text-sm text-gray-500">
          Esse lead não existe ou foi removido. Verifique o link ou volte para a lista.
        </p>
      </div>
    </div>
  );
}
