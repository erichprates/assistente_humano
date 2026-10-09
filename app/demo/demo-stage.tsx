"use client";

import { useEffect, useState } from "react";
import { ContactButton } from "@/components/contact-button";
import { asset } from "@/lib/asset";

// Tamanho de exibição no computador: 50% maior que o de origem (48px de altura).
const ZOOM = 1.5;
// Largura que o botão precisa para caber inteiro; no celular o tamanho é
// reduzido até isso caber na tela.
const FIT_WIDTH = 360;
const SIDE_MARGIN = 24;

export function DemoStage() {
  const [zoom, setZoom] = useState(ZOOM);
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined);
  const [run, setRun] = useState(0);

  // ?zoom=4 abre em outro tamanho (útil para gravar/comparar frames).
  useEffect(() => {
    const forced = Number(
      new URLSearchParams(window.location.search).get("zoom"),
    );
    // Largura real do aparelho: innerWidth pode crescer se o navegador
    // reduzir o zoom da página, e o botão não deve mudar de tamanho por isso.
    let last = 0;
    const update = () => {
      const width = Math.min(
        document.documentElement.clientWidth,
        window.screen.width,
      );
      if (width === last) return;
      last = width;
      const room = width - SIDE_MARGIN;
      const z = forced > 0 ? forced : Math.min(ZOOM, room / FIT_WIDTH);
      setZoom(z);
      setMaxWidth(room / z);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <main className="relative flex flex-1 items-center justify-center bg-[#f6f6f6]">
      {/* Fundo: prints da página de estoque do site (computador e celular),
          fixos, só para simular o botão no lugar onde ele vai ser usado. */}
      <div
        aria-hidden
        className="fixed inset-0 hidden bg-top bg-no-repeat sm:block"
        style={{
          backgroundImage: `url(${asset("/site-estoque.jpg")})`,
          backgroundSize: "100% auto",
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 bg-top bg-no-repeat sm:hidden"
        style={{
          backgroundImage: `url(${asset("/site-estoque-mobile.jpg")})`,
          backgroundSize: "100% auto",
        }}
      />

      <div className="relative" style={{ zoom }}>
        <ContactButton
          key={run}
          label="Tem um consultor humano disponível"
          hoverLabel="Falar agora!"
          chipLabel="Diego"
          maxWidth={maxWidth}
          // O Replay mostra a abertura na hora; só a primeira visita espera.
          startDelayMs={run === 0 ? undefined : 150}
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
