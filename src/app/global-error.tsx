"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <h1 style={{ fontSize: 48, color: "#CC0000", margin: 0 }}>Erro</h1>
            <p style={{ marginTop: 12, fontWeight: 600 }}>Algo deu errado no aplicativo</p>
            <p style={{ marginTop: 4, fontSize: 14, color: "#666", wordBreak: "break-word" }}>
              {error.message || "Erro inesperado."}
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 24, padding: "10px 20px", background: "#CC0000", color: "white", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 }}
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
