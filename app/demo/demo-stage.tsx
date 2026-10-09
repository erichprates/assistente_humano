"use client";

import { useEffect, useState } from "react";
import { ContactButton } from "@/components/contact-button";
import { asset } from "@/lib/asset";

// Tamanho de exibição: 50% maior que o de origem (48px de altura).
const ZOOM = 1.5;

export function DemoStage() {
  const [zoom, setZoom] = useState(ZOOM);
  const [run, setRun] = useState(0);

  // ?zoom=4 abre em outro tamanho (útil para gravar/comparar frames).
  useEffect(() => {
    const z = Number(new URLSearchParams(window.location.search).get("zoom"));
    if (z > 0) setZoom(z);
  }, []);

  return (
    // Fundo: print da página de estoque do site, fixo, só para simular o
    // botão no lugar onde ele vai ser usado.
    <main
      className="relative flex flex-1 items-center justify-center bg-[#f6f6f6] bg-fixed bg-top bg-no-repeat"
      style={{
        backgroundImage: `url(${asset("/site-estoque.jpg")})`,
        backgroundSize: "100% auto",
      }}
    >
      <div style={{ zoom }}>
        <ContactButton
          key={run}
          label="Tem um consultor humano disponível"
          hoverLabel="Falar agora!"
          chipLabel="Diego"
          // Na demo os contatos só vão para o console do navegador.
          onLead={(lead, consultant) => console.log("lead", lead, consultant)}
        />
      </div>

      <button
        onClick={() => setRun((r) => r + 1)}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 cursor-pointer rounded-full bg-ink/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink"
      >
        Replay
      </button>
    </main>
  );
}
