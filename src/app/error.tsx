"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-bold text-[#CC0000]">Ops</h1>
        <p className="mt-3 text-lg font-semibold text-gray-800">Algo deu errado</p>
        <p className="mt-1 text-sm text-gray-500 break-words">
          {error.message || "Erro inesperado. Tente novamente."}
        </p>
        {error.digest && (
          <p className="mt-1 text-[10px] text-gray-400">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-block mt-6 px-5 py-2.5 bg-[#CC0000] text-white text-sm font-medium rounded-lg hover:bg-[#990000] transition-colors"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
