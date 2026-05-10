import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-[#CC0000]">404</h1>
        <p className="mt-3 text-lg font-semibold text-gray-800">Página não encontrada</p>
        <p className="mt-1 text-sm text-gray-500">O recurso que você procurou não existe ou foi removido.</p>
        <Link
          href="/"
          className="inline-block mt-6 px-5 py-2.5 bg-[#CC0000] text-white text-sm font-medium rounded-lg hover:bg-[#990000] transition-colors"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
