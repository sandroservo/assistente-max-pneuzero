/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * /treinamento — tutorial em vídeo (player interativo) embutido no dashboard.
 * O HTML estático fica em public/treinamento/ e é carregado via iframe,
 * mantendo o usuário dentro do sistema.
 */

export const metadata = {
  title: "Treinamento — Tutorial da Luma",
};

export default function TreinamentoPage() {
  return (
    <div className="h-full w-full bg-[#0a0f17]">
      <iframe
        src="/treinamento/tutorial-luma-pneuzero.html"
        title="Tutorial da Luma — Pneuzero"
        className="h-full w-full border-0"
        allow="autoplay"
      />
    </div>
  );
}
