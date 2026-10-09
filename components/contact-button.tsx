"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { asset } from "@/lib/asset";
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type Transition,
} from "motion/react";

// "reset" é um instante, já coberto pela pill escura, em que o verde volta
// escondido para o tamanho de ponto antes de reaparecer em "idle".
type Phase = "idle" | "hover" | "leaving" | "reset";
// Abertura: nada → círculo branco com o avatar → expande e vira o botão.
// Fechar é a abertura ao contrário: recolhe até o círculo com o avatar
// ("collapse"), some ("vanish") e sai da tela ("closed").
type Intro =
  "hidden" | "avatar" | "expand" | "done" | "collapse" | "vanish" | "closed";

// Depois do clique a pill vira uma conversa curta: pergunta ("ask"), escolha
// do consultor ("pick") e a confirmação de quem vai atender ("wait").
// Por último pede os contatos, um campo por vez ("form"), e agradece ("done").
type View = "button" | "ask" | "pick" | "wait" | "form" | "done";

export type Lead = { name: string; email: string; whatsapp: string };

const digits = (value: string) => value.replace(/\D/g, "");
// (11) 91234-5678, montado conforme a pessoa digita.
const maskPhone = (value: string) => {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const split = d.length > 10 ? 7 : 6;
  return d.length <= split
    ? `(${d.slice(0, 2)}) ${d.slice(2)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
};

const FIELDS = [
  {
    key: "name",
    prompt: "Como posso te chamar?",
    placeholder: "Seu nome",
    type: "text",
    inputMode: "text",
    autoComplete: "name",
    valid: (v: string) => v.trim().length >= 2,
  },
  {
    key: "email",
    prompt: "Qual é o seu e-mail?",
    placeholder: "seu@email.com",
    type: "email",
    inputMode: "email",
    autoComplete: "email",
    valid: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  },
  {
    key: "whatsapp",
    prompt: "E o seu WhatsApp?",
    placeholder: "(00) 00000-0000",
    type: "tel",
    inputMode: "tel",
    autoComplete: "tel-national",
    valid: (v: string) => digits(v).length >= 10,
  },
] as const;

export type Consultant = {
  name: string;
  /** Artigo usado nas frases ("com o Diego", "com a Alessandra"). Padrão: "o". */
  article?: "o" | "a";
  /** Foto; sem ela o avatar mostra a inicial sobre `color`. */
  avatar?: string;
  color?: string;
};

// O primeiro é o consultor de plantão (abertura, chip e resposta "Não").
const DEFAULT_CONSULTANTS: Consultant[] = [
  { name: "Diego", avatar: asset("/consultores/diego.jpg") },
  {
    name: "Alessandra",
    article: "a",
    avatar: asset("/consultores/alessandra.jpg"),
  },
  { name: "Dulio", avatar: asset("/consultores/dulio.jpg") },
  { name: "José Luiz", avatar: asset("/consultores/jose-luiz.jpg") },
  { name: "Matheus", avatar: asset("/consultores/matheus.jpg") },
  { name: "Nathan", avatar: asset("/consultores/nathan.jpg") },
  { name: "Rogério", avatar: asset("/consultores/rogerio.jpg") },
  { name: "Tiago", avatar: asset("/consultores/tiago.jpg") },
];

const INK = "#141618";
// Cor de destaque (ponto e fundo do hover).
const ACCENT = "#ff4b3e";
const WHITE = "#ffffff";

// Geometria (px) medida nos frames do vídeo original.
// Largura com os textos do original; a real é medida a partir dos textos.
const W = 154;
const H = 48;
const R = H / 2;
const DOT = { top: 19, right: 14, width: 10, height: 10 };
const CIRCLE = { top: 5, right: 5, width: 38, height: 38 };
// Espaço fixo em volta de cada texto: margem esquerda + respiro + ponto (ou
// círculo da seta) + margem direita.
const REST_CHROME = 71;
const HOVER_CHROME = 70;
// Largura de texto do original, referência para a inclinação.
const TILT_REF = 84;
// Fileira de avatares na escolha do consultor, e o avatar de quem atende.
// Na escolha a pill some e os avatares ficam soltos, com contorno branco.
const PICK_SIZE = 42;
const PICK_STEP = 54;
// Em tela de toque não há hover: o nome fica sempre sob cada avatar, então a
// grade precisa de mais espaço entre eles.
// No toque são avatares maiores, no máximo 3 por linha.
const PICK_SIZE_TOUCH = 64;
const PICK_COLS_TOUCH = 3;
const PICK_STEP_TOUCH = 100;
const PICK_ROW = 58;
const PICK_ROW_TOUCH = 104;
const PICK_INSET = 3;
const PICK_RING = 2;
const PICK_CHIP =
  "w-max -translate-x-1/2 rounded-full bg-white shadow-[0_2px_10px_rgba(20,22,24,0.16)] px-[11px] py-[5px] text-[12.5px] leading-none font-semibold whitespace-nowrap text-ink";
const WAIT_TEXT_LEFT = 53;
// Tempo em repouso até o × aparecer sozinho, para mostrar que dá para fechar.
const CLOSE_HINT_MS = 1500;
// Tempo com a mensagem de quem atende antes de pedir os contatos.
const WAIT_MS = 2200;
// Largura da pill no formulário e raio do anel de progresso no avatar.
const FORM_W = 312;
const PROGRESS_R = 19;
// Spring da mudança de largura no hover e do deslize que segue o cursor.
const RESIZE = { type: "spring", stiffness: 220, damping: 21 } as const;

// Tempo que a pill escura leva para cobrir o verde antes de voltar ao repouso.
const LEAVE_MS = 510;
// Atraso do preenchimento em relação ao texto, que sai primeiro.
const LAG_IN = 0.1;
const LAG_OUT = 0.1;

// Abertura (ms): espera inicial, tempo só com o avatar, duração da expansão.
const INTRO_DELAY_MS = 4000;
const INTRO_HOLD_MS = 850;
const INTRO_EXPAND_MS = 750;
// Fechamento (ms): recolher até o círculo, depois sumir.
const CLOSE_COLLAPSE_MS = 540;
const CLOSE_VANISH_MS = 300;
// Minimizado: bolinha fixa no canto inferior direito da tela.
const MINI_SIZE = 48;
const MINI_MARGIN = 20;
const MINI_FLIGHT = { type: "spring", stiffness: 190, damping: 24 } as const;
// Descida: o tamanho usa uma spring mais solta que a posição.
const MINI_LANDING = { type: "spring", stiffness: 230, damping: 17 } as const;
// Garantia para a troca pelo círculo real, caso o pouso não seja detectado.
const MINI_BACK_MS = 1400;
// Tempo sem ninguém encostar no botão até ele se recolher sozinho.
const AUTO_MINIMIZE_MS = 5000;
// Celular: sem hover, o botão mostra o "Falar agora!" sozinho, uma vez.
const PEEK_DELAY_MS = 1400;
const PEEK_HOLD_MS = 2000;

// Borda gelatinosa: folga em volta da pill para o contorno poder estufar,
// largura da região afetada e resolução do contorno. PAD casa com -inset-3.
const PAD = 12;
const JELLY_SIGMA = 13;
const ARC_STEPS = 40;

const instant: Transition = { duration: 0 };
// Preenchimento: a altura fecha antes da largura, como no original.
const fill = (delay: number): Transition => ({
  type: "spring",
  stiffness: 245,
  damping: 20,
  delay,
  top: { type: "spring", stiffness: 400, damping: 28, delay },
  height: { type: "spring", stiffness: 400, damping: 28, delay },
});

/**
 * Contorno da pill como clip-path, com os pontos perto de (cx, cy)
 * deslocados por (dx, dy). Coordenadas relativas à "pele", que é PAD maior
 * que a pill em cada lado.
 */
function pillPath(w: number, dx: number, dy: number, cx: number, cy: number) {
  const still = Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01;
  const k = 1 / (2 * JELLY_SIGMA * JELLY_SIGMA);
  let d = "";
  const add = (x: number, y: number) => {
    if (!still) {
      const g = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) * k);
      x += dx * g;
      y += dy * g;
    }
    d += `${d ? "L" : "M"}${(x + PAD).toFixed(2)} ${(y + PAD).toFixed(2)}`;
  };
  // Semicírculo direito (de cima para baixo) e depois o esquerdo.
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / ARC_STEPS;
    add(w - R + R * Math.cos(a), R + R * Math.sin(a));
  }
  // A reta de baixo também precisa de pontos para poder deformar.
  const straight = Math.max(0, Math.ceil((w - H) / 3));
  for (let i = 1; i < straight; i++) add(w - R - ((w - H) * i) / straight, H);
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / ARC_STEPS;
    add(R + R * Math.cos(a), R + R * Math.sin(a));
  }
  for (let i = 1; i < straight; i++) add(R + ((w - H) * i) / straight, 0);
  return `path("${d}Z")`;
}

/**
 * Texto que entra/sai inclinado. Um "carrier" curto leva o texto até o lugar
 * e springs bem soltas perseguem esse carrier: a chegada é suave, mas sobra
 * o balanço longo e de baixa amplitude do original (período ~0.3s).
 */
function useLabel({
  away,
  awayY,
  awayRotate,
  enterDelay,
  exitDelay,
}: {
  away: boolean;
  awayY: number;
  awayRotate: number;
  enterDelay: number;
  exitDelay: number;
}) {
  const p = useMotionValue(away ? 1 : 0);

  useEffect(() => {
    const controls = animate(
      p,
      away ? 1 : 0,
      away
        ? { duration: 0.2, ease: "easeOut", delay: exitDelay }
        : { duration: 0.32, ease: "easeInOut", delay: enterDelay },
    );
    return () => controls.stop();
  }, [p, away, enterDelay, exitDelay]);

  const y = useSpring(useTransform(p, [0, 1], [0, awayY]), {
    stiffness: 450,
    damping: 6,
  });
  const rotate = useSpring(useTransform(p, [0, 1], [0, awayRotate]), {
    stiffness: 320,
    damping: 7,
  });
  // Pelo carrier (não pela spring) para o balanço não reacender o texto.
  const opacity = useTransform(p, [0.5, 0.95], [1, 0]);

  return { y, rotate, opacity };
}

function Avatar({
  consultant,
  size,
  fill,
}: {
  consultant?: Consultant;
  size?: number;
  fill?: boolean;
}) {
  const box = fill ? "absolute inset-0" : "relative shrink-0";
  const style = fill ? undefined : { width: size, height: size };
  if (consultant?.avatar) {
    return (
      <span
        className={`${box} block overflow-hidden rounded-full`}
        style={style}
      >
        <Image
          src={consultant.avatar}
          alt=""
          fill
          sizes="40px"
          className="scale-105 object-cover"
          unoptimized
        />
      </span>
    );
  }
  return (
    <span
      className={`${box} flex items-center justify-center rounded-full text-white`}
      style={{
        ...style,
        backgroundColor: consultant?.color ?? INK,
        fontSize: (size ?? 38) * 0.42,
      }}
    >
      {consultant?.name.charAt(0)}
    </span>
  );
}

/**
 * Botão minimizado. Fica fixo no canto, mas nasce exatamente sobre o círculo
 * recolhido (`from`) e voa até lá; com `to`, faz o caminho de volta.
 */
function MiniBubble({
  consultant,
  label,
  from,
  to,
  onClick,
  onArrive,
}: {
  consultant?: Consultant;
  label: string;
  from: { left: number; top: number; size: number };
  to: { left: number; top: number; size: number } | null;
  onClick: () => void;
  onArrive: () => void;
}) {
  // Posição do canto no momento do voo, para converter um ponto da tela em
  // deslocamento a partir do lugar fixo.
  const offset = (spot: { left: number; top: number; size: number }) => ({
    x:
      spot.left -
      (document.documentElement.clientWidth - MINI_MARGIN - MINI_SIZE),
    y: spot.top - (window.innerHeight - MINI_MARGIN - MINI_SIZE),
    scale: spot.size / MINI_SIZE,
  });

  // A spring demora para parar de vez; a troca pelo círculo real acontece
  // quando a bolinha já chegou visualmente.
  const arrived = useRef(onArrive);
  useEffect(() => {
    arrived.current = onArrive;
  });
  // A troca acontece quando a bolinha encosta de fato no destino (ver
  // onUpdate); o timer é só uma garantia caso a animação não rode.
  const landed = useRef(false);
  const land = () => {
    if (landed.current) return;
    landed.current = true;
    arrived.current();
  };
  useEffect(() => {
    landed.current = false;
    if (!to) return;
    const id = setTimeout(land, MINI_BACK_MS);
    return () => clearTimeout(id);
  }, [to]);

  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`fixed z-50 cursor-pointer rounded-full bg-white p-[5px] shadow-[0_2px_10px_rgba(20,22,24,0.16)] outline-offset-2 ${
        to ? "pointer-events-none" : ""
      }`}
      style={{
        bottom: MINI_MARGIN,
        right: MINI_MARGIN,
        width: MINI_SIZE,
        height: MINI_SIZE,
        originX: 0,
        originY: 0,
      }}
      initial={offset(from)}
      animate={to ? offset(to) : { x: 0, y: 0, scale: 1 }}
      transition={
        // Na descida o tamanho chega com um leve excesso, como quem pousa.
        to ? { ...MINI_FLIGHT, scale: MINI_LANDING } : MINI_FLIGHT
      }
      onUpdate={(latest) => {
        if (!to) return;
        const target = offset(to);
        if (
          Math.abs(Number(latest.x) - target.x) < 1 &&
          Math.abs(Number(latest.y) - target.y) < 1 &&
          Math.abs(Number(latest.scale) - target.scale) < 0.015
        )
          land();
      }}
    >
      <motion.span
        className="relative block size-full"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
      >
        <Avatar consultant={consultant} fill />
      </motion.span>

      {/* Aviso vermelho: aparece ao pousar e pulsa como o ponto "ao vivo" */}
      <motion.span
        aria-hidden
        className="absolute -top-[2px] -right-[2px] size-[14px] rounded-full border-2 border-white"
        style={{ backgroundColor: ACCENT }}
        initial={{ scale: 0 }}
        animate={{ scale: to ? 0 : 1 }}
        transition={
          to
            ? { duration: 0.12 }
            : { type: "spring", stiffness: 500, damping: 16, delay: 0.55 }
        }
      >
        {!to && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: ACCENT }}
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: [1, 2.6], opacity: [0.5, 0] }}
            transition={{
              duration: 1.5,
              ease: "easeOut",
              repeat: Infinity,
              repeatDelay: 0.25,
              delay: 0.9,
            }}
          />
        )}
      </motion.span>
    </motion.button>
  );
}

export function ContactButton({
  label = "Get in touch",
  hoverLabel = "Don't be shy",
  chipLabel = "Hi!",
  intro: playIntro = true,
  startDelayMs = INTRO_DELAY_MS,
  closable = true,
  minimize = true,
  autoMinimizeMs = AUTO_MINIMIZE_MS,
  maxWidth,
  closeLabel = "Fechar",
  onClose,
  consultants = DEFAULT_CONSULTANTS,
  question = "Você já é cliente?",
  yesLabel = "Sim",
  noLabel = "Não",
  pickHint = "Escolha seu consultor",
  waitLabel: waitText = (c: Consultant) => `${c.name} já vai te atender`,
  contactLabel: contactText = (c: Consultant) =>
    `Já vou tentar contato com ${c.article ?? "o"} ${c.name}`,
  onConsultant,
  thanksLabel: thanksText = (name: string) => `Obrigado, ${name}!`,
  onLead,
}: {
  label?: string;
  hoverLabel?: string;
  chipLabel?: string;
  /** Abre a partir do nada (círculo com avatar que expande até virar o botão). */
  intro?: boolean;
  /** Tempo na página antes de o botão aparecer pela primeira vez. */
  startDelayMs?: number;
  /** Mostra o × no canto; fechar recolhe o botão e chama onClose no fim. */
  closable?: boolean;
  /**
   * Ao fechar, o rosto de quem atende vai para o canto inferior direito da
   * tela com um aviso vermelho; clicar nele reabre o botão. Com `false`, some.
   */
  minimize?: boolean;
  /** Recolhe sozinho após esse tempo sem interação (0 desliga). */
  autoMinimizeMs?: number;
  /**
   * Largura disponível (px). Define em quantas linhas os avatares se
   * distribuem. Padrão: a largura da janela menos uma margem.
   */
  maxWidth?: number;
  closeLabel?: string;
  onClose?: () => void;
  consultants?: Consultant[];
  question?: string;
  yesLabel?: string;
  noLabel?: string;
  pickHint?: string;
  /** Mensagem quando quem atende é o consultor de plantão (o primeiro). */
  waitLabel?: (consultant: Consultant) => string;
  /** Mensagem quando o cliente escolhe alguém que não está de plantão. */
  contactLabel?: (consultant: Consultant) => string;
  /** Chamado quando o atendimento é definido: escolhido (Sim) ou padrão (Não). */
  onConsultant?: (consultant: Consultant, isClient: boolean) => void;
  thanksLabel?: (firstName: string) => string;
  /** Chamado ao concluir o formulário, com os contatos e quem vai atender. */
  onLead?: (lead: Lead, consultant: Consultant) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [intro, setIntro] = useState<Intro>(playIntro ? "hidden" : "done");
  // O chip responde a uma área um pouco maior que o botão, então aparece
  // antes de o cursor encostar na pill e some depois de ele sair.
  const [near, setNear] = useState(false);
  const [closeFocused, setCloseFocused] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [closeHinted, setCloseHinted] = useState(false);
  const [view, setView] = useState<View>("button");
  const [chosen, setChosen] = useState(0);
  const [pickHover, setPickHover] = useState<number | null>(null);
  // Último avatar apontado: mantém nome e posição enquanto o chip some.
  const [pickLast, setPickLast] = useState(0);
  // Aberto de fato (não só montado): vale para a 1ª vez e para cada reabertura.
  const opened = intro === "expand" || intro === "done";
  // Os avatares entram em cascata; depois disso respondem ao hover na hora.
  const [pickPopped, setPickPopped] = useState(false);
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState<Lead>({ name: "", email: "", whatsapp: "" });
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Depois da mensagem de quem atende, passa sozinho para o formulário.
  useEffect(() => {
    if (view !== "wait") return;
    const id = setTimeout(() => setView("form"), WAIT_MS);
    return () => clearTimeout(id);
  }, [view]);
  // O foco acompanha o campo da vez, já com a troca em andamento.
  useEffect(() => {
    if (view !== "form" || !opened) return;
    const id = setTimeout(() => inputs.current[step]?.focus(), 320);
    return () => clearTimeout(id);
  }, [view, step, opened]);
  useEffect(() => {
    if (view !== "pick" || !opened) return;
    const id = setTimeout(() => setPickPopped(true), 700);
    return () => clearTimeout(id);
  }, [view, opened]);
  // Sem hover (toque) não há "chegar perto": o × fica sempre à mostra.
  const [touch, setTouch] = useState(false);
  const [viewportW, setViewportW] = useState(Infinity);
  useEffect(() => {
    setTouch(window.matchMedia("(hover: none)").matches);
    const update = () => setViewportW(window.innerWidth - 32);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const avail = maxWidth ?? viewportW;
  // Telas estreitas: o que fica "pendurado" para fora da pill é trazido para dentro.
  const compact = avail < 420;
  const prev = useRef<Phase>("idle");
  const sized = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  // Bolinha minimizada: "out" voa até o canto e fica lá; "back" volta ao lugar.
  type Spot = { left: number; top: number; size: number };
  const [mini, setMini] = useState<"none" | "out" | "back">("none");
  const [miniFrom, setMiniFrom] = useState<Spot | null>(null);
  const [miniTo, setMiniTo] = useState<Spot | null>(null);
  // Reabertura: o círculo já chega pronto, sem o "pop" nem a espera inicial.
  const [replay, setReplay] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // Pedido de fechar: espera a pill voltar ao repouso antes de recolher.
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (closing && phase === "idle" && intro === "done") setIntro("collapse");
  }, [closing, phase, intro]);
  // Parado no estado inicial e sem o cursor por perto, recolhe sozinho.
  const untouched =
    minimize &&
    autoMinimizeMs > 0 &&
    intro === "done" &&
    !closing &&
    view === "button" &&
    phase === "idle" &&
    !near &&
    !closeFocused;
  useEffect(() => {
    if (!untouched) return;
    const id = setTimeout(() => setClosing(true), autoMinimizeMs);
    return () => clearTimeout(id);
  }, [untouched, autoMinimizeMs]);

  useEffect(() => {
    prev.current = phase;
    if (phase === "leaving") {
      const id = setTimeout(() => setPhase("reset"), LEAVE_MS - 40);
      return () => clearTimeout(id);
    }
    if (phase === "reset") {
      const id = setTimeout(() => setPhase("idle"), 40);
      return () => clearTimeout(id);
    }
  }, [phase]);

  useEffect(() => {
    // Reabrindo, a bolinha ainda está voando de volta: a abertura espera.
    if (mini !== "none" && intro !== "collapse") return;
    if (intro === "collapse") {
      const id = setTimeout(() => {
        const rect = bodyRef.current?.getBoundingClientRect();
        if (minimize && rect) {
          // A bolinha fixa assume exatamente onde o círculo recolhido está.
          setMiniFrom({ left: rect.left, top: rect.top, size: rect.height });
          setMini("out");
          setIntro("closed");
        } else {
          setIntro("vanish");
        }
      }, CLOSE_COLLAPSE_MS);
      return () => clearTimeout(id);
    }
    const next: Partial<Record<Intro, [Intro, number]>> = {
      hidden: ["avatar", startDelayMs],
      avatar: ["expand", replay ? 40 : INTRO_HOLD_MS],
      expand: ["done", INTRO_EXPAND_MS],
      vanish: ["closed", CLOSE_VANISH_MS],
    };
    if (intro === "closed") onCloseRef.current?.();
    const step = next[intro];
    if (!step) return;
    const id = setTimeout(() => setIntro(step[0]), step[1]);
    return () => clearTimeout(id);
  }, [intro, mini, minimize, replay, startDelayMs]);

  const open = intro === "expand" || intro === "done";
  const ready = intro === "done" && !closing;
  const collapsed =
    intro === "collapse" || intro === "vanish" || intro === "closed";
  const gone = intro === "hidden" || intro === "vanish" || intro === "closed";
  const hovered = phase === "hover";
  // Fora da conversa a pill é o botão com hover; dentro, só os controles.
  const interactive = ready && view === "button";
  const chip = ready && (closeHovered || (interactive && (near || hovered)));
  const closeShown =
    ready && !hovered && (near || closeFocused || touch || closeHinted);
  useEffect(() => {
    if (intro !== "done") return;
    const id = setTimeout(() => setCloseHinted(true), CLOSE_HINT_MS);
    return () => clearTimeout(id);
  }, [intro]);
  // Voltando de "leaving" a pill escura já está visível: não espera o verde.
  const rehover = prev.current === "leaving" || prev.current === "reset";

  // Largura da pill: círculo na abertura, botão depois.
  // A pill cresce para caber o texto mais largo (medido já com a fonte).
  const restRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const askRef = useRef<HTMLSpanElement>(null);
  const answersRef = useRef<HTMLDivElement>(null);
  const waitRef = useRef<HTMLSpanElement>(null);
  const thanksRef = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState({
    rest: W - REST_CHROME,
    active: 0,
    ask: 0,
    answers: 0,
    wait: 0,
    thanks: 0,
  });
  const thanks = thanksText(lead.name.trim().split(/\s+/)[0] ?? "");
  // Só o primeiro da lista está de plantão; os outros precisam ser chamados.
  const onDuty = chosen === 0;
  const attendant = consultants[chosen];
  const waitMessage = attendant
    ? (onDuty ? waitText : contactText)(attendant)
    : "";
  useLayoutEffect(() => {
    const measure = () =>
      setText({
        rest: restRef.current?.offsetWidth ?? 0,
        active: activeRef.current?.offsetWidth ?? 0,
        ask: askRef.current?.offsetWidth ?? 0,
        answers: answersRef.current?.offsetWidth ?? 0,
        wait: waitRef.current?.offsetWidth ?? 0,
        thanks: thanksRef.current?.offsetWidth ?? 0,
      });
    measure();
    document.fonts.ready.then(measure);
  }, [label, hoverLabel, question, yesLabel, noLabel, waitMessage, thanks]);
  // Cada estado tem a largura do seu texto: a pill encolhe ou cresce no hover.
  const restW = Math.ceil(text.rest + REST_CHROME);
  const hoverW = Math.ceil(text.active + HOVER_CHROME);
  // Texto longo gira menos, para a ponta subir o mesmo tanto que no original.
  const tilt = (width: number) => Math.min(1, TILT_REF / (width || TILT_REF));

  // Grade de avatares: uma linha se couber; senão divide em linhas iguais,
  // centradas na altura da pill.
  const pickSize = touch ? PICK_SIZE_TOUCH : PICK_SIZE;
  const pickStepX = touch ? PICK_STEP_TOUCH : PICK_STEP;
  const pickStepY = touch ? PICK_ROW_TOUCH : PICK_ROW;
  const pickMaxCols = Math.max(
    1,
    Math.min(
      touch ? PICK_COLS_TOUCH : Infinity,
      Math.floor((avail - PICK_INSET * 2 - pickSize) / pickStepX) + 1,
    ),
  );
  const pickRows = Math.ceil(
    consultants.length / Math.min(consultants.length, pickMaxCols),
  );
  const pickCols = Math.ceil(consultants.length / pickRows);
  const pickW = PICK_INSET * 2 + pickSize + pickStepX * (pickCols - 1);
  // Quanto a grade passa da pill para cima e para baixo.
  const pickLift = ((pickRows - 1) / 2) * pickStepY;
  const pickSpot = (i: number) => {
    const row = Math.floor(i / pickCols);
    // A última linha pode ter menos gente: fica centralizada.
    const inRow = Math.min(pickCols, consultants.length - row * pickCols);
    return {
      left: PICK_INSET + ((i % pickCols) + (pickCols - inRow) / 2) * pickStepX,
      rise: (row - (pickRows - 1) / 2) * pickStepY,
    };
  };
  // Na conversa a largura é a do conteúdo, e o espaço ocupado acompanha.
  const viewW =
    view === "ask"
      ? Math.ceil(15 + text.ask + 16 + text.answers + 8)
      : view === "pick"
        ? pickW
        : view === "wait"
          ? // Sem plantão não há ponto "ao vivo": sobra só a margem direita.
            Math.ceil(
              WAIT_TEXT_LEFT + text.wait + (onDuty ? REST_CHROME - 15 : 20),
            )
          : view === "form"
            ? FORM_W
            : view === "done"
              ? Math.ceil(WAIT_TEXT_LEFT + text.thanks + 16 + 38 + 5)
              : null;
  const layoutTarget = viewW ?? restW;
  // Os preenchimentos usam a maior largura; o que sobrar é recortado.
  const full = {
    top: 0,
    right: 0,
    width: Math.max(restW, hoverW, viewW ?? 0),
    height: H,
  };

  const width = useMotionValue(playIntro ? H : W);
  const layoutWidth = useMotionValue(W);
  useEffect(() => {
    if (intro !== "done") {
      layoutWidth.set(layoutTarget);
      return;
    }
    const controls = animate(layoutWidth, layoutTarget, RESIZE);
    return () => controls.stop();
  }, [intro, layoutTarget, layoutWidth]);
  const target = viewW ?? (hovered ? hoverW : restW);
  useEffect(() => {
    if (!open) return;
    if (!playIntro && !sized.current) {
      sized.current = true;
      width.set(target);
      return;
    }
    sized.current = true;
    const controls = animate(width, target, {
      ...RESIZE,
      damping: ready ? RESIZE.damping : 18,
      delay: ready && hovered ? LAG_IN : 0,
    });
    return () => controls.stop();
  }, [open, ready, hovered, playIntro, target, width]);

  // Borda gelatinosa: um deslocamento (dx, dy) aplicado ao contorno em volta
  // do ponto por onde o cursor cruzou a borda. Entrar empurra a borda para
  // dentro, sair puxa para fora, e uma spring solta devolve tudo ao lugar.
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const clipPath = useTransform(() =>
    pillPath(width.get(), dx.get(), dy.get(), cx.get(), cy.get()),
  );
  const pointer = useRef({ x: 0, y: 0, t: 0, vx: 0, vy: 0 });

  const track = (e: PointerEvent) => {
    const last = pointer.current;
    const dt = e.timeStamp - last.t;
    if (dt > 0 && dt < 100) {
      // Média móvel para a velocidade não depender de um único evento.
      const vx = ((e.clientX - last.x) / dt) * 1000;
      const vy = ((e.clientY - last.y) / dt) * 1000;
      last.vx = last.vx * 0.5 + vx * 0.5;
      last.vy = last.vy * 0.5 + vy * 0.5;
    } else {
      last.vx = 0;
      last.vy = 0;
    }
    last.x = e.clientX;
    last.y = e.clientY;
    last.t = e.timeStamp;
  };

  const wobble = (e: PointerEvent<HTMLElement>, direction: 1 | -1) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.height / H || 1;
    // O link mantém a largura de repouso; a pill pode estar mais curta.
    const w = width.get();
    const x = (e.clientX - rect.left) / scale - offsetX.get();
    const y = (e.clientY - rect.top) / scale;
    // Normal da pill no ponto de contato, a partir do eixo central.
    const ax = Math.min(Math.max(x, R), w - R);
    let nx = x - ax;
    let ny = y - R;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    cx.set(ax + nx * R);
    cy.set(R + ny * R);

    const { vx, vy, t } = pointer.current;
    const speed = Math.hypot(vx, vy) / scale;
    const fresh = e.timeStamp - t < 80 && speed > 20;
    // Sem velocidade confiável (toque, teclado), empurra pela normal.
    const ux = fresh ? vx / scale / speed : nx * direction;
    const uy = fresh ? vy / scale / speed : ny * direction;
    const kick = fresh ? Math.min(Math.max(speed * 0.12, 100), 180) : 130;
    const spring = { type: "spring", stiffness: 300, damping: 11 } as const;
    animate(dx, 0, { ...spring, velocity: ux * kick });
    animate(dy, 0, { ...spring, velocity: uy * kick });
  };

  // No hover a pill fica centrada no cursor (dentro do espaço de repouso) e
  // desliza junto com ele, então o clique nunca sai de baixo do mouse.
  const offsetX = useMotionValue(0);
  const follow = (e: PointerEvent<HTMLElement>, delay: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.height / H || 1;
    const x = (e.clientX - rect.left) / scale;
    const slack = restW - hoverW;
    const to = Math.min(
      Math.max(x - hoverW / 2, Math.min(0, slack)),
      Math.max(0, slack),
    );
    animate(offsetX, to, { ...RESIZE, delay });
  };

  // Fechando: a pill recolhe para a ponta direita, onde estão o ponto e o ×,
  // e o avatar reaparece no lugar do ponto.
  useEffect(() => {
    if (!collapsed) return;
    const spring = { type: "spring", stiffness: 240, damping: 25 } as const;
    const a = animate(width, H, { ...spring, delay: 0.08 });
    const b = animate(offsetX, layoutTarget - H, { ...spring, delay: 0.08 });
    return () => {
      a.stop();
      b.stop();
    };
  }, [collapsed, layoutTarget, width, offsetX]);

  const enter = (e?: PointerEvent<HTMLElement>) => {
    if (!interactive) return;
    if (e && phase !== "hover") {
      wobble(e, -1);
      follow(e, LAG_IN);
    }
    setPhase("hover");
  };
  const leave = (e?: PointerEvent<HTMLElement>) => {
    if (e && phase === "hover") wobble(e, 1);
    animate(offsetX, 0, RESIZE);
    setPhase((p) => (p === "hover" ? "leaving" : p));
  };

  const restLabel = useLabel({
    away: hovered || !open || view !== "button",
    awayY: 26,
    awayRotate: -8 * tilt(text.rest),
    enterDelay: 0.18,
    exitDelay: 0.03,
  });
  const activeLabel = useLabel({
    away: !hovered,
    awayY: -26,
    awayRotate: 9 * tilt(text.active),
    enterDelay: 0.18,
    exitDelay: 0,
  });

  const askLabel = useLabel({
    away: view !== "ask" || !open,
    awayY: 26,
    awayRotate: -8 * tilt(text.ask),
    enterDelay: 0.18,
    exitDelay: 0,
  });
  const waitLabel = useLabel({
    away: view !== "wait" || !open,
    awayY: 26,
    awayRotate: -8 * tilt(text.wait),
    enterDelay: 0.3,
    exitDelay: 0,
  });

  const thanksLabel = useLabel({
    away: view !== "done" || !open,
    awayY: 26,
    awayRotate: -8 * tilt(text.thanks),
    enterDelay: 0.2,
    exitDelay: 0,
  });
  // Campos do formulário: entram por baixo e, respondidos, saem por cima.
  const fieldWidth = FORM_W - WAIT_TEXT_LEFT - 48;
  const fieldMotion = (i: number) => ({
    away: view !== "form" || step !== i || !open,
    awayY: view === "done" || step > i ? -26 : 26,
    awayRotate: (view === "done" || step > i ? 8 : -8) * tilt(fieldWidth),
    enterDelay: 0.16,
    exitDelay: 0,
  });
  const fieldStyles = [
    useLabel(fieldMotion(0)),
    useLabel(fieldMotion(1)),
    useLabel(fieldMotion(2)),
  ];
  const field = FIELDS[step];
  const fieldValid = field.valid(lead[field.key]);
  const next = () => {
    if (view !== "form") return;
    if (!fieldValid) {
      // Campo inválido: a pill balança, como um "não" com a cabeça.
      animate(offsetX, [0, -7, 7, -4, 4, 0], { duration: 0.36 });
      inputs.current[step]?.focus();
      return;
    }
    if (step < FIELDS.length - 1) {
      // Foco no próximo campo já dentro do toque/Enter: no celular é isso
      // que mantém o teclado aberto de um campo para o outro.
      inputs.current[step + 1]?.focus({ preventScroll: true });
      setStep(step + 1);
      return;
    }
    inputs.current[step]?.blur();
    setView("done");
    if (attendant) onLead?.(lead, attendant);
  };

  // Celular: como não há hover, a animação acontece sozinha uma vez, pouco
  // depois de o botão abrir, com a pill centrada no espaço de repouso.
  const peeked = useRef(false);
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!touch || !interactive || phase !== "idle" || peeked.current) return;
    const id = setTimeout(() => {
      peeked.current = true;
      setPeek(true);
    }, PEEK_DELAY_MS);
    return () => clearTimeout(id);
  }, [touch, interactive, phase]);
  useEffect(() => {
    if (!peek) return;
    animate(offsetX, Math.max(0, (restW - hoverW) / 2), {
      ...RESIZE,
      delay: LAG_IN,
    });
    setPhase("hover");
    const id = setTimeout(() => {
      animate(offsetX, 0, RESIZE);
      setPhase((p) => (p === "hover" ? "leaving" : p));
      setPeek(false);
    }, PEEK_HOLD_MS);
    return () => clearTimeout(id);
    // Só o início da espiada dispara; as larguras já estão medidas aqui.
  }, [peek]);

  // Clique no botão: sai do hover como numa saída normal e abre a pergunta.
  const start = () => {
    if (!interactive) return;
    animate(offsetX, 0, RESIZE);
    setPhase((p) => (p === "hover" ? "leaving" : p));
    setView("ask");
  };
  const settle = (index: number, isClient: boolean) => {
    setChosen(index);
    setView("wait");
    if (consultants[index]) onConsultant?.(consultants[index], isClient);
  };

  const filled = phase === "hover" || phase === "leaving";
  const live = view === "button" || (view === "wait" && onDuty);
  // No toque os nomes já estão sob cada avatar.
  const nameShown = open && view === "pick" && pickHover !== null && !touch;
  const dotVisible = open && phase === "idle" && live;

  // Reabrindo, a pill se estende para a esquerda: o inverso de recolher.
  useEffect(() => {
    if (replay && intro === "expand") {
      animate(offsetX, 0, { ...RESIZE, damping: 18 });
    }
  }, [replay, intro, offsetX]);

  // Clique na bolinha: reabre de onde a pessoa parou (pergunta, escolha,
  // formulário...), só limpando o que era do cursor.
  const restart = () => {
    if (mini !== "out") return;
    setPhase("idle");
    setClosing(false);
    setCloseHinted(false);
    setCloseHovered(false);
    setPickHover(null);
    setPickPopped(false);
    setNear(false);
    // Volta a ser o círculo na ponta direita, exatamente como saiu.
    width.set(H);
    offsetX.set(layoutTarget - H);
    setReplay(true);
    setMini("back");
    setIntro("hidden");
  };
  // Com o botão de volta ao layout (ainda invisível), mede a ponta direita,
  // de onde o círculo saiu: é para lá que a bolinha voa de volta.
  useLayoutEffect(() => {
    if (mini !== "back" || intro !== "hidden") return;
    const rect = layoutRef.current?.getBoundingClientRect();
    if (rect)
      setMiniTo({
        left: rect.right - rect.height,
        top: rect.top,
        size: rect.height,
      });
  }, [mini, intro]);

  const bubble =
    mini !== "none" && miniFrom && typeof document !== "undefined"
      ? createPortal(
          <MiniBubble
            consultant={consultants[0]}
            label={label}
            from={miniFrom}
            to={mini === "back" ? miniTo : null}
            onClick={restart}
            onArrive={() => {
              // O círculo real aparece por baixo e a bolinha sai logo depois,
              // para não haver um quadro vazio na troca.
              setIntro("avatar");
              setTimeout(() => {
                setMini("none");
                setMiniTo(null);
              }, 90);
            }}
          />,
          document.body,
        )
      : null;

  // A bolinha fica sempre na mesma posição da árvore: se mudasse de lugar
  // ao reabrir, seria remontada e perderia o voo de volta.
  return (
    <>
      {intro !== "closed" && (
        <div
          className="-m-3 inline-block p-3"
          onPointerEnter={() => setNear(true)}
          onPointerLeave={() => setNear(false)}
          onPointerMove={track}
        >
          <motion.div
            ref={layoutRef}
            className="relative"
            // Depois da abertura o espaço ocupado é fixo (largura de repouso):
            // só a pill muda de tamanho, sem empurrar o layout nem fugir do cursor.
            style={{
              // Na reabertura a pill cresce a partir da ponta direita, de onde
              // saiu, então o espaço já tem a largura final.
              width:
                intro === "done" || collapsed || replay ? layoutWidth : width,
              height: H,
            }}
          >
            <motion.div
              // A sombra é um filtro no corpo porque a pele é recortada por
              // clip-path; assim os elementos brancos aparecem em fundo claro.
              className="pointer-events-none absolute top-0 drop-shadow-[0_2px_8px_rgba(20,22,24,0.16)]"
              style={{
                width,
                height: H,
                left: 0,
                x: offsetX,
              }}
              ref={bodyRef}
              initial={false}
              animate={
                gone ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }
              }
              transition={
                replay && intro === "avatar"
                  ? { duration: 0 }
                  : collapsed
                    ? {
                        // Some com um leve "impulso" antes de encolher.
                        duration: 0.26,
                        ease: "backIn",
                        opacity: { duration: 0.12, delay: 0.14 },
                      }
                    : {
                        type: "spring",
                        stiffness: 420,
                        damping: 17,
                        opacity: { duration: 0.12 },
                      }
              }
            >
              {/* Pele: tudo que é visual, recortado pelo contorno deformável */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -inset-3 text-[15.5px] leading-none font-semibold"
                style={{ clipPath }}
                initial={false}
                animate={{
                  backgroundColor: !open ? WHITE : hovered ? ACCENT : INK,
                  opacity: view === "pick" && open ? 0 : 1,
                }}
                transition={{
                  // A pill dá lugar aos avatares na escolha e volta em seguida.
                  opacity:
                    view === "pick"
                      ? { duration: 0.2, delay: 0.08 }
                      : { duration: 0.22, delay: 0.1 },
                  backgroundColor:
                    // Fora da abertura, troca a cor de base só depois de coberta,
                    // para a borda não vazar.
                    intro === "expand"
                      ? { duration: 0.28 }
                      : collapsed
                        ? { duration: 0.3, delay: 0.12 }
                        : { duration: 0, delay: 0.3 },
                }}
              >
                <div className="absolute inset-3">
                  {/* Pulso "ao vivo": anel que se expande do ponto, só em repouso */}
                  {ready && phase === "idle" && live && (
                    <motion.span
                      className="absolute rounded-full"
                      style={{ ...DOT, backgroundColor: ACCENT }}
                      initial={{ scale: 1, opacity: 0 }}
                      animate={{ scale: [1, 2.8], opacity: [0.55, 0] }}
                      transition={{
                        duration: 1.5,
                        ease: "easeOut",
                        repeat: Infinity,
                        repeatDelay: 0.25,
                        delay: 0.2,
                      }}
                    />
                  )}

                  {/* Ponto que cresce até preencher a pill */}
                  <motion.span
                    className="absolute rounded-full"
                    style={{ backgroundColor: ACCENT }}
                    initial={false}
                    animate={
                      filled
                        ? { ...full, opacity: 1, scale: 1 }
                        : dotVisible
                          ? { ...DOT, opacity: 1, scale: 1 }
                          : { ...DOT, opacity: 0, scale: 0.4 }
                    }
                    transition={
                      filled
                        ? fill(LAG_IN)
                        : dotVisible
                          ? {
                              ...instant,
                              opacity: {
                                duration: 0.12,
                                delay: intro === "expand" ? 0.34 : 0.06,
                              },
                              scale: {
                                type: "spring",
                                stiffness: 500,
                                damping: 22,
                                delay: intro === "expand" ? 0.34 : 0.06,
                              },
                            }
                          : instant
                    }
                  />

                  <motion.span
                    ref={activeRef}
                    className="absolute top-0 left-4 flex h-full origin-left items-center whitespace-nowrap text-ink"
                    style={activeLabel}
                  >
                    {hoverLabel}
                  </motion.span>

                  {/* Círculo da seta; na saída ele cresce e vira o fundo escuro */}
                  <motion.span
                    className="absolute overflow-hidden rounded-full bg-ink"
                    initial={false}
                    animate={
                      phase === "idle"
                        ? { ...DOT, opacity: 0 }
                        : phase === "hover"
                          ? { ...CIRCLE, opacity: 1 }
                          : { ...full, opacity: 1 }
                    }
                    transition={
                      phase === "idle"
                        ? instant
                        : phase === "hover"
                          ? {
                              type: "spring",
                              stiffness: 260,
                              damping: 24,
                              delay: rehover ? 0 : 0.36,
                              opacity: {
                                duration: 0.3,
                                delay: rehover ? 0 : 0.33,
                              },
                            }
                          : { ...fill(LAG_OUT), opacity: { duration: 0.08 } }
                    }
                  >
                    <motion.svg
                      viewBox="0 0 23 13"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      className="absolute top-1/2 right-[7.5px] -mt-[6.5px] h-[13px] w-[23px] overflow-visible"
                      initial={false}
                      animate={{
                        opacity: hovered ? 1 : 0,
                        scale: phase === "idle" ? 0.5 : 1,
                      }}
                      transition={
                        phase === "idle"
                          ? instant
                          : hovered
                            ? {
                                type: "spring",
                                stiffness: 260,
                                damping: 24,
                                delay: rehover ? 0 : 0.36,
                                opacity: {
                                  duration: 0.2,
                                  delay: rehover ? 0 : 0.44,
                                },
                              }
                            : { duration: 0.18, delay: 0.08 }
                      }
                    >
                      <path d="M0 6.5H21.5M15.5 0.5L21.5 6.5L15.5 12.5" />
                    </motion.svg>
                  </motion.span>

                  <motion.span
                    ref={restRef}
                    className="absolute top-0 left-[15px] flex h-full origin-left items-center whitespace-nowrap text-white"
                    style={restLabel}
                  >
                    {label}
                  </motion.span>

                  <motion.span
                    ref={askRef}
                    className="absolute top-0 left-[15px] flex h-full origin-left items-center whitespace-nowrap text-white"
                    style={askLabel}
                  >
                    {question}
                  </motion.span>

                  <motion.span
                    ref={waitRef}
                    className="absolute top-0 flex h-full origin-left items-center whitespace-nowrap text-white"
                    style={{ ...waitLabel, left: WAIT_TEXT_LEFT }}
                  >
                    {waitMessage}
                  </motion.span>

                  <motion.span
                    ref={thanksRef}
                    className="absolute top-0 flex h-full origin-left items-center whitespace-nowrap text-white"
                    style={{ ...thanksLabel, left: WAIT_TEXT_LEFT }}
                  >
                    {thanks}
                  </motion.span>

                  {/* Avatar da abertura: encolhe até o lugar do ponto verde */}
                  <motion.span
                    className="absolute overflow-hidden rounded-full"
                    initial={false}
                    animate={
                      open ? { ...DOT, opacity: 0 } : { ...CIRCLE, opacity: 1 }
                    }
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 24,
                      delay: open ? 0.06 : 0,
                      opacity: open
                        ? { duration: 0.14, delay: 0.26 }
                        : { duration: 0.16 },
                    }}
                  >
                    <Avatar consultant={consultants[0]} fill />
                  </motion.span>
                </div>
              </motion.div>

              <motion.div
                aria-hidden
                className="pointer-events-none absolute top-full mt-[11px] flex w-max origin-left items-center gap-[6px] rounded-full bg-white shadow-[0_2px_10px_rgba(20,22,24,0.16)] py-[2px] pr-[11px] pl-[2px] text-[12.5px] leading-none font-semibold whitespace-nowrap text-ink"
                // Mesma posição relativa do original: começa 20px antes do fim.
                // Em tela estreita alinha pela direita, para não sair da tela.
                style={{
                  ...(compact
                    ? { right: 0, transformOrigin: "right center" }
                    : { left: "calc(100% - 20px)" }),
                  // No celular o chip é maior: é ele que apresenta quem atende.
                  ...(touch && {
                    fontSize: 16,
                    gap: 8,
                    padding: "3px 14px 3px 3px",
                  }),
                }}
                initial={false}
                animate={
                  chip ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }
                }
                transition={
                  chip
                    ? {
                        type: "spring",
                        stiffness: 90,
                        damping: 11,
                        opacity: { duration: 0.15 },
                      }
                    : {
                        type: "spring",
                        stiffness: 260,
                        damping: 28,
                        delay: 0.05,
                        opacity: { duration: 0.18, delay: 0.08 },
                      }
                }
              >
                {/* Com o cursor no ×, o chip explica a ação em vez de mostrar quem atende */}
                {closeHovered ? (
                  <span className="py-[3px] pl-[9px]">{closeLabel}</span>
                ) : (
                  <>
                    <Avatar
                      consultant={consultants[0]}
                      size={touch ? 28 : 18}
                    />
                    {chipLabel}
                  </>
                )}
              </motion.div>

              {/* Controles da conversa: ficam por cima da pele e andam com a pill */}
              <div
                ref={answersRef}
                className="absolute top-2 right-2 flex gap-[6px] text-[14px] leading-none font-semibold"
              >
                {[yesLabel, noLabel].map((answer, i) => (
                  <motion.button
                    key={i}
                    type="button"
                    tabIndex={ready && view === "ask" ? undefined : -1}
                    onClick={() =>
                      i === 0 ? setView("pick") : settle(0, false)
                    }
                    className={`h-8 cursor-pointer rounded-full px-[14px] outline-offset-2 ${
                      i === 0 ? "bg-white text-ink" : "bg-white/15 text-white"
                    } ${ready && view === "ask" ? "pointer-events-auto" : ""}`}
                    initial={false}
                    animate={
                      open && view === "ask"
                        ? { scale: 1, opacity: 1 }
                        : { scale: 0, opacity: 0 }
                    }
                    whileHover={{ scale: 1.07 }}
                    whileTap={{ scale: 0.93 }}
                    transition={
                      view === "ask"
                        ? {
                            type: "spring",
                            stiffness: 420,
                            damping: 18,
                            delay: 0.3 + i * 0.06,
                            opacity: { duration: 0.12, delay: 0.3 + i * 0.06 },
                          }
                        : { duration: 0.14 }
                    }
                  >
                    {answer}
                  </motion.button>
                ))}
              </div>

              {consultants.map((consultant, i) => {
                const picking = open && view === "pick";
                const attending =
                  open &&
                  (view === "wait" || view === "form" || view === "done") &&
                  i === chosen;
                return (
                  <motion.button
                    key={i}
                    type="button"
                    aria-label={consultant.name}
                    tabIndex={ready && picking ? undefined : -1}
                    onClick={() => settle(i, true)}
                    onPointerEnter={() => {
                      setPickHover(i);
                      setPickLast(i);
                    }}
                    onPointerLeave={() =>
                      setPickHover((h) => (h === i ? null : h))
                    }
                    onFocus={() => {
                      setPickHover(i);
                      setPickLast(i);
                    }}
                    onBlur={() => setPickHover((h) => (h === i ? null : h))}
                    className={`absolute cursor-pointer rounded-full bg-white shadow-[0_2px_10px_rgba(20,22,24,0.16)] outline-offset-2 ${
                      ready && picking ? "pointer-events-auto" : ""
                    }`}
                    style={{
                      padding: PICK_RING,
                      top: (H - pickSize) / 2 + pickSpot(i).rise,
                      left: pickSpot(i).left,
                      width: pickSize,
                      height: pickSize,
                    }}
                    initial={false}
                    animate={
                      picking
                        ? { x: 0, y: 0, scale: 1, opacity: 1 }
                        : attending
                          ? // Quem atende desliza até a ponta esquerda da pill.
                            {
                              x: R - (pickSpot(i).left + pickSize / 2),
                              y: -pickSpot(i).rise,
                              scale: 40 / pickSize,
                              opacity: 1,
                            }
                          : { x: 0, y: 0, scale: 0, opacity: 0 }
                    }
                    whileHover={picking ? { scale: 1.16, y: -3 } : undefined}
                    whileTap={picking ? { scale: 0.92 } : undefined}
                    transition={
                      picking
                        ? {
                            type: "spring",
                            stiffness: 420,
                            damping: 17,
                            delay: pickPopped ? 0 : 0.16 + i * 0.045,
                            opacity: {
                              duration: 0.12,
                              delay: pickPopped ? 0 : 0.16 + i * 0.045,
                            },
                          }
                        : attending
                          ? { type: "spring", stiffness: 240, damping: 22 }
                          : { duration: 0.14 }
                    }
                  >
                    <span className="relative block size-full">
                      <Avatar consultant={consultant} fill />
                    </span>
                    {/* No toque não existe hover para revelar o nome */}
                    {touch && picking && (
                      <span className="pointer-events-none absolute top-full left-1/2 mt-[6px] -translate-x-1/2 rounded-full bg-white px-[9px] py-[4px] text-[12.5px] leading-none font-semibold whitespace-nowrap text-ink shadow-[0_2px_10px_rgba(20,22,24,0.16)]">
                        {consultant.name}
                      </span>
                    )}
                  </motion.button>
                );
              })}

              {/* Texto fixo em cima: a instrução da escolha ou a pergunta do campo */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute bottom-full left-1/2"
                style={{ marginBottom: 10 + (view === "pick" ? pickLift : 0) }}
                initial={false}
                animate={
                  open && (view === "pick" || view === "form")
                    ? { scale: 1, opacity: 1 }
                    : { scale: 0, opacity: 0 }
                }
                transition={
                  view === "pick" || view === "form"
                    ? {
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                        delay: 0.3,
                        opacity: { duration: 0.14, delay: 0.3 },
                      }
                    : { duration: 0.14 }
                }
              >
                {/* A cada campo o texto troca com um pequeno pop */}
                <motion.div
                  key={view === "form" ? step : "pick"}
                  className={PICK_CHIP}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                >
                  {view === "form" || view === "done" ? field.prompt : pickHint}
                </motion.div>
              </motion.div>

              {/* Anel de progresso em volta de quem atende: um terço por campo */}
              <motion.svg
                aria-hidden
                viewBox="0 0 40 40"
                className="pointer-events-none absolute top-1 left-1 size-10 -rotate-90"
                initial={false}
                animate={{
                  opacity: open && (view === "form" || view === "done") ? 1 : 0,
                }}
                transition={{ duration: 0.2 }}
              >
                <motion.circle
                  cx="20"
                  cy="20"
                  r={PROGRESS_R}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={false}
                  animate={{
                    pathLength:
                      view === "done"
                        ? 1
                        : view === "form"
                          ? step / FIELDS.length
                          : 0,
                    // Com a ponta arredondada, comprimento zero ainda desenha um ponto.
                    opacity:
                      view === "done" || (view === "form" && step > 0) ? 1 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </motion.svg>

              {FIELDS.map((f, i) => {
                const current = ready && view === "form" && step === i;
                return (
                  <motion.input
                    key={f.key}
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    type={f.type}
                    inputMode={f.inputMode}
                    autoComplete={f.autoComplete}
                    name={f.key}
                    aria-label={f.prompt}
                    placeholder={f.placeholder}
                    enterKeyHint={i < FIELDS.length - 1 ? "next" : "send"}
                    tabIndex={current ? undefined : -1}
                    value={lead[f.key]}
                    onChange={(e) =>
                      setLead((l) => ({
                        ...l,
                        [f.key]:
                          f.key === "whatsapp"
                            ? maskPhone(e.target.value)
                            : e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        next();
                      }
                    }}
                    className={`absolute top-0 h-full origin-left bg-transparent text-[15.5px] font-semibold text-white outline-none placeholder:text-white/40 ${
                      current ? "pointer-events-auto" : ""
                    }`}
                    style={{
                      ...fieldStyles[i],
                      left: WAIT_TEXT_LEFT,
                      width: fieldWidth,
                      caretColor: ACCENT,
                      // Abaixo de 16px o iOS dá zoom na página ao focar o campo.
                      ...(touch && { fontSize: 16 }),
                    }}
                  />
                );
              })}

              {/* Avançar: acende quando o campo é válido e vira o "feito" no fim */}
              <motion.button
                type="button"
                aria-label={step < FIELDS.length - 1 ? "Continuar" : "Enviar"}
                tabIndex={ready && view === "form" ? undefined : -1}
                onClick={next}
                // Tocar na seta não tira o foco do campo (o teclado não fecha).
                onPointerDown={(e) => e.preventDefault()}
                className={`absolute top-[5px] right-[5px] flex size-[38px] cursor-pointer items-center justify-center rounded-full outline-offset-2 ${
                  ready && view === "form" ? "pointer-events-auto" : ""
                }`}
                initial={false}
                animate={{
                  scale: open && (view === "form" || view === "done") ? 1 : 0,
                  opacity: open && (view === "form" || view === "done") ? 1 : 0,
                  backgroundColor:
                    view === "done" || fieldValid
                      ? ACCENT
                      : "rgba(255, 255, 255, 0.14)",
                }}
                whileHover={view === "form" ? { scale: 1.08 } : undefined}
                whileTap={view === "form" ? { scale: 0.9 } : undefined}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 18,
                  delay: view === "form" && step === 0 ? 0.25 : 0,
                  backgroundColor: { duration: 0.2 },
                  opacity: { duration: 0.12 },
                }}
              >
                <motion.svg
                  viewBox="0 0 23 13"
                  fill="none"
                  strokeWidth="2"
                  className="absolute h-[13px] w-[23px] overflow-visible"
                  initial={false}
                  animate={{
                    opacity: view === "done" ? 0 : 1,
                    x: view === "done" ? 10 : 0,
                    stroke: fieldValid ? INK : "rgba(255, 255, 255, 0.6)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <path d="M0 6.5H21.5M15.5 0.5L21.5 6.5L15.5 12.5" />
                </motion.svg>
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke={INK}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute size-5"
                >
                  <motion.path
                    d="M4.5 10.5L8.5 14.5L15.5 6"
                    initial={false}
                    animate={{
                      pathLength: view === "done" ? 1 : 0,
                      opacity: view === "done" ? 1 : 0,
                    }}
                    transition={{
                      pathLength: {
                        type: "spring",
                        stiffness: 160,
                        damping: 18,
                        delay: view === "done" ? 0.18 : 0,
                      },
                      opacity: {
                        duration: 0.01,
                        delay: view === "done" ? 0.18 : 0,
                      },
                    }}
                  />
                </svg>
              </motion.button>

              {/* Nome do consultor sob o cursor: aparece embaixo e segue o hover */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute top-full"
                style={{ marginTop: 10 + pickLift }}
                initial={false}
                animate={{
                  left: pickSpot(pickLast).left + pickSize / 2,
                  scale: nameShown ? 1 : 0,
                  opacity: nameShown ? 1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 26,
                  scale: { type: "spring", stiffness: 380, damping: 22 },
                  opacity: { duration: 0.12 },
                }}
              >
                <div className={PICK_CHIP}>{consultants[pickLast]?.name}</div>
              </motion.div>
            </motion.div>

            {/* O botão em si: área de clique estável, que não deforma */}
            <button
              type="button"
              data-contact-main
              onClick={start}
              onPointerEnter={enter}
              onPointerMove={(e) => phase === "hover" && follow(e, 0)}
              onPointerLeave={leave}
              onFocus={() => enter()}
              onBlur={() => leave()}
              tabIndex={interactive ? undefined : -1}
              className={`absolute inset-0 cursor-pointer rounded-full outline-offset-4 ${
                interactive ? "" : "pointer-events-none"
              }`}
            >
              <span className="sr-only">{label}</span>
            </button>

            {/* Fechar: selo branco no canto superior direito, fora da pill que
            se move. Aparece quando o cursor chega perto e some no hover. */}
            {closable && (
              <motion.button
                type="button"
                aria-label={closeLabel}
                onClick={() => setClosing(true)}
                onPointerEnter={() => setCloseHovered(true)}
                onPointerLeave={() => setCloseHovered(false)}
                onFocus={() => setCloseFocused(true)}
                onBlur={() => setCloseFocused(false)}
                tabIndex={ready ? undefined : -1}
                // Clicável mesmo antes de aparecer: entrar aqui tira o hover da
                // pill, e é isso que faz o × surgir.
                // Na escolha em várias linhas, sobe para o canto da grade.
                style={{
                  top: -9 - (open && view === "pick" ? pickLift : 0),
                  // Em grade, afasta do último avatar para não parecer dele.
                  right: open && view === "pick" && pickRows > 1 ? -30 : -9,
                }}
                className={`absolute flex size-[26px] cursor-pointer items-center justify-center rounded-full outline-offset-0 ${
                  ready ? "" : "pointer-events-none"
                }`}
                initial={false}
                animate={closeShown ? "shown" : "hidden"}
                whileHover="hover"
                whileTap="tap"
              >
                <motion.span
                  className="flex size-5 items-center justify-center rounded-full bg-white text-ink shadow-[0_2px_10px_rgba(20,22,24,0.16)]"
                  variants={{
                    hidden: { scale: 0, opacity: 0 },
                    shown: { scale: 1, opacity: 1 },
                    hover: { scale: 1.15 },
                    tap: { scale: 0.85 },
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 18,
                    opacity: { duration: 0.12 },
                  }}
                >
                  <motion.svg
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    className="size-2"
                    variants={{
                      hidden: { rotate: -90 },
                      shown: { rotate: 0 },
                      hover: { rotate: 90 },
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 14 }}
                  >
                    <path d="M1 1L9 9M9 1L1 9" />
                  </motion.svg>
                </motion.span>
              </motion.button>
            )}
          </motion.div>
        </div>
      )}
      {bubble}
    </>
  );
}
