# Assistente humano — manual do protótipo

Botão animado de atendimento ("Tem um consultor humano disponível") feito em
Next.js, Motion e Tailwind. Este documento registra o que o protótipo faz, como
foi construído e o que ficou em aberto para a próxima fase (componente do
atendente, CRM e incorporação no site).

- **Demonstração:** https://erichprates.github.io/assistente_humano/
- **Código do componente:** `components/contact-button.tsx`
- **Página de demonstração:** `app/demo/demo-stage.tsx`

> O que está aqui é um protótipo de interface. Nenhum dado é enviado a lugar
> algum: os contatos digitados só aparecem no console do navegador.

---

## 1. O que o protótipo faz

O fluxo completo, na ordem em que o visitante vê:

| # | Etapa | O que acontece |
|---|-------|----------------|
| 1 | Espera | Nada aparece nos primeiros 4 segundos de página. |
| 2 | Abertura | Surge um círculo branco com a foto do consultor de plantão; ele se expande e vira a pill escura com o texto "Tem um consultor humano disponível" e um ponto vermelho pulsando ("ao vivo"). |
| 3 | Repouso | Depois de 1,5 s aparece o × de fechar no canto superior direito. Com o cursor perto, surge o chip com a foto e o nome do consultor. |
| 4 | Hover | O texto sai inclinado, o ponto vermelho cresce e preenche a pill, entra "Falar agora!" e o círculo da seta. A pill encolhe para o tamanho do texto e fica centrada no cursor, acompanhando o mouse. A borda reage ao cursor como gelatina. |
| 5 | Clique | A pill pergunta "Você já é cliente?" com os botões **Sim** e **Não**. |
| 6a | Sim | A pill some e 8 avatares entram em cascata, com "Escolha seu consultor" em cima e o nome sob o avatar apontado. |
| 6b | Não | Vai direto para o consultor de plantão. |
| 7 | Mensagem | "Diego já vai te atender" (plantão) ou "Já vou tentar contato com o/a …" (outro consultor). Fica 2,2 s na tela (1,6 s no celular, onde o teclado já sobe nesse momento). |
| 8 | Contatos | Um campo por vez dentro da pill: nome, e-mail e WhatsApp. O contorno do avatar vai se preenchendo de vermelho como progresso. Campo inválido faz a pill balançar. |
| 9 | Fim | A seta vira um ✓ e entra "Obrigado, {primeiro nome}!". |

Em qualquer etapa:

- **Fechar (×):** a pill recolhe até o círculo com a foto, que voa para o canto
  inferior direito da tela e ganha uma bolinha vermelha de notificação.
- **Reabrir:** clicar na bolinha faz o caminho inverso e **retoma de onde a
  pessoa parou** (etapa, consultor escolhido e o que já foi digitado).
- **A primeira frase aparece uma vez só.** Quem reabre sem ter avançado já
  sabe que há um consultor: o botão volta direto como "Falar agora!" com o chip
  de quem atende, e fica assim.
- **Recolher sozinho:** no estado inicial, 5 s sem o cursor por perto fazem o
  botão se fechar e ir para o canto (10 s depois de uma reabertura).

No celular, onde não existe hover, a etapa 4 acontece sozinha: 1,8 s depois de
abrir, o botão passa para "Falar agora!" e fica assim. Os consultores aparecem
em linhas de 3, com fotos maiores e o nome sempre visível.

---

## 2. Como rodar

Requer Node 20 ou mais novo.

```bash
npm install
npm run dev        # http://localhost:3000
```

A raiz (`/`) e `/demo` mostram a mesma demonstração: o botão sobre um print da
página de estoque do site (versão de computador ou de celular, conforme a
largura da janela), usado só como fundo de simulação. O botão **Replay** recria
o componente do zero e mostra a abertura na hora, sem a espera de 4 s.

`?zoom=4` no endereço amplia o botão; serve para inspecionar a animação quadro
a quadro.

### Publicar no GitHub Pages

```bash
npm run publish:pages
```

O script gera a versão estática (`out/`) com o prefixo `/assistente_humano` e
envia para o branch `gh-pages`, que é o que o GitHub Pages serve. Detalhes em
`scripts/publish-pages.sh`.

---

## 3. Como usar o componente

```tsx
import { ContactButton } from "@/components/contact-button";

<ContactButton
  label="Tem um consultor humano disponível"
  hoverLabel="Falar agora!"
  chipLabel="Diego"
  onConsultant={(consultor, jaEhCliente) => { /* atendimento definido */ }}
  onLead={(contatos, consultor) => { /* nome, e-mail e WhatsApp preenchidos */ }}
  onClose={() => { /* minimizou */ }}
/>
```

A largura da pill é medida a partir dos textos, então qualquer frase cabe.

### Opções

| Opção | Padrão | Para que serve |
|-------|--------|----------------|
| `label` | — | Texto em repouso. |
| `hoverLabel` | — | Texto no hover. |
| `chipLabel` | — | Texto do chip que aparece embaixo (nome do plantonista). |
| `consultants` | lista com os 8 consultores | `{ name, avatar?, article?, color? }`. **O primeiro é o de plantão.** |
| `intro` | `true` | Abre a partir do nada. |
| `startDelayMs` | `4000` | Tempo de página antes da primeira aparição. |
| `closable` | `true` | Mostra o ×. |
| `minimize` | `true` | Ao fechar, vira a bolinha no canto; com `false`, some. |
| `autoMinimizeMs` | `5000` | Recolhe sozinho após esse tempo parado (`0` desliga). |
| `maxWidth` | largura da janela − 32 px | Largura disponível; define em quantas linhas os avatares se distribuem. |
| `question`, `yesLabel`, `noLabel` | "Você já é cliente?", "Sim", "Não" | Textos da pergunta. |
| `pickHint` | "Escolha seu consultor" | Texto acima dos avatares. |
| `waitLabel(c)` | "{nome} já vai te atender" | Mensagem para o plantonista. |
| `contactLabel(c)` | "Já vou tentar contato com o/a {nome}" | Mensagem para quem não está de plantão. |
| `thanksLabel(nome)` | "Obrigado, {nome}!" | Mensagem final. |
| `closeLabel` | "Fechar" | Texto do chip e rótulo acessível do ×. |
| `onConsultant(c, cliente)` | — | Disparado quando o atendimento é definido. |
| `onLead(contatos, c)` | — | Disparado ao concluir o formulário. |
| `onClose()` | — | Disparado quando o botão minimiza (ou some). |

Cor de destaque (`ACCENT`, hoje `#ff4b3e`) e cor escura (`INK`) são constantes
no topo do arquivo do componente.

---

## 4. Como foi construído

### 4.1 Ponto de partida: um vídeo de referência

A animação de hover foi recriada a partir de um vídeo de 12 s (1600×1200,
30 fps) de um botão "Get in touch → Don't be shy". O vídeo não está no
repositório; o método foi:

1. **Extrair os frames** com `ffmpeg` e montar folhas de contato, primeiro a
   10 fps para entender a sequência, depois os trechos de transição quadro a
   quadro (30 fps).
2. **Medir** no próprio vídeo: geometria (altura 48 px, ponto de 10 px, círculo
   da seta de 38 px, margens), cores e a posição de cada elemento em cada frame.
3. **Implementar** e **gravar a própria versão** em Chrome headless na mesma
   escala e no mesmo enquadramento do vídeo, a ~30 fps.
4. **Comparar lado a lado** (original em cima, versão embaixo) e ajustar
   atrasos e constantes das springs. Foram 7 rodadas até as duas sequências
   baterem em cerca de 1 frame.

O mesmo ciclo de gravar e conferir foi usado em todas as etapas criadas depois
(abertura, fechar, conversa, formulário, voo da bolinha). Dois defeitos só
apareceram assim: um texto "fantasma" que reacendia no meio do hover e a
descida da bolinha, que teleportava em vez de voar.

### 4.2 Decisões técnicas que definem a sensação

**Nada é linear.** Todo movimento visível passa por uma spring.

**Texto com balanço longo (a parte mais difícil de acertar).**
No original o texto chega suave, mas continua balançando com amplitude pequena
e período de ~0,3 s. Uma spring simples não reproduz isso: ou chega suave, ou
balança. A solução foi ajustada numericamente contra as posições medidas nos
frames: um *carrier* curto (0,32 s) leva o texto até o lugar e springs bem
soltas (`stiffness 450, damping 6` para a posição; `320 / 7` para a rotação)
perseguem esse carrier. O erro em relação às medições caiu para cerca de um
quarto do melhor resultado com spring simples. A opacidade segue o carrier, e
não a spring, para o balanço não reacender o texto que saiu. Os campos do
formulário usam a mesma entrada, mas com springs firmes (`450 / 34`): com o
balanço longo, as primeiras letras digitadas ficavam tremendo.

**Preenchimento que cresce a partir do ponto.**
O ponto vermelho é um elemento que anima `top/right/width/height` até cobrir a
pill. A altura usa uma spring mais rígida que a largura, porque no original ela
fecha antes. Na saída o círculo da seta faz o mesmo e vira o fundo escuro.

**Borda gelatinosa.**
A pill não usa `border-radius`: o contorno é um `clip-path` gerado a cada
quadro como polígono. Quando o cursor cruza a borda, os pontos próximos são
deslocados (peso gaussiano em volta do ponto de contato) na direção do
movimento do mouse, e uma spring solta devolve tudo ao lugar. Entrar empurra a
borda para dentro; sair puxa para fora.

**Área de clique separada do desenho.**
Como a pill deforma, encolhe e segue o cursor, o elemento clicável é um botão
transparente com a largura de repouso, por cima. Sem isso a pill fugiria do
mouse e o hover ficaria piscando.

**Largura por conteúdo.**
Os textos são medidos depois de a fonte carregar; cada etapa tem sua largura e
a pill anima de uma para outra. Textos longos giram menos, para a ponta subir o
mesmo tanto que no original.

**Abertura e fechamento são a mesma animação ao contrário.**
O avatar do círculo encolhe exatamente até o lugar do ponto vermelho; ao fechar,
o ponto vira a foto de novo.

**Bolinha minimizada.**
É um elemento `fixed` separado, renderizado em portal. Ele nasce exatamente
sobre o círculo recolhido (posição e tamanho medidos na tela) e voa até o
canto; na volta faz o inverso e a troca pelo círculo real acontece quando ele
encosta de fato no destino.

**Celular.**
Em tela de toque não existe hover, então: o botão passa sozinho para o estado
de hover logo após a abertura e permanece nele, com o chip de quem atende em
tamanho maior; os avatares se dividem em linhas
de até 3, com fotos maiores (8 consultores viram 3 + 3 + 2), o nome fica
sempre visível sob cada foto, o × fica sempre à mostra, o chip se alinha pela
direita para não sair da tela e os campos usam fonte de 16 px (abaixo disso o
iOS dá zoom na página ao focar). O navegador do celular só abre o teclado dentro
de um toque; por isso o campo do nome recebe o foco já no toque em "Não" ou no
consultor (o teclado sobe durante a mensagem de quem atende, que lá dura 1,6 s),
e ao avançar o foco passa para o próximo campo no próprio toque, mantendo o
teclado aberto até o último. Na demonstração o botão inteiro é reduzido até
caber na largura do aparelho.

**Nada pode ser mais largo que a pill.**
Vários elementos existem o tempo todo e só ficam invisíveis (textos de outras
etapas, campos do formulário, avatares). Se algum deles for mais largo que a
pill recolhida, a página ganha largura e o navegador do celular reduz o zoom de
tudo: foi um defeito real, visto como "o botão diminui na tela". Por isso a
pele e os campos têm recorte próprio, os avatares ficam recolhidos sob a pill
antes da escolha e a pill muda de largura junto com o espaço que ocupa. Vale
conferir `scrollWidth` da página ao mexer no layout.

O recorte dos campos é `overflow: clip`, não `hidden`: uma caixa `hidden` ainda
pode ser rolada, e o navegador a rolava ao focar o campo que entrava de baixo,
deixando o texto digitado acima do centro da pill (visto no computador).

**Preenchimento automático.**
Quando o navegador preenche o campo sozinho, ele pinta um fundo colorido atrás
do texto e não deixa trocar essa cor. Os campos usam uma transição de duração
"infinita" na cor de fundo (a pintura nunca chega a aparecer) e forçam o texto
branco. Só vale para o campo já preenchido: a barra de sugestões do teclado e a
prévia ao passar o mouse na sugestão são do navegador e não mudam.

**Balão de quem atende e o ×.**
O balão "Diego" sob a pill aparece quando o cursor chega perto do botão, antes
de encostar. No canto superior direito, que é o caminho até o ×, ele não
aparece: ali só surge "Fechar", com o cursor já sobre o ×.

**Anel de progresso.**
O anel vermelho em volta do avatar é um pouco mais espesso que o contorno
branco (3,5 contra 2) e o cobre por inteiro; com a mesma espessura sobrava um
filete branco atrás do vermelho.

**Sombras.**
Os elementos brancos (chips, ×, contorno dos avatares, círculo da abertura)
têm uma sombra suave para aparecerem sobre o fundo claro do site. Na pill ela é
um filtro `drop-shadow` no elemento pai, porque o `clip-path` cortaria uma
sombra comum.

### 4.3 Estrutura do componente

Tudo está em `components/contact-button.tsx`. Três máquinas de estado
independentes controlam o que aparece:

| Estado | Valores | Controla |
|--------|---------|----------|
| `intro` | `hidden → avatar → expand → done → collapse → vanish/closed` | Abertura, fechamento e minimização. |
| `phase` | `idle → hover → leaving → reset → idle` | A animação de hover. |
| `view` | `button → ask → pick → wait → form → done` | Em que etapa da conversa está. |

Camadas, de baixo para cima:

1. **Pele** — tudo que é visual e fica dentro da pill (fundo, preenchimentos,
   textos), recortado pelo `clip-path` deformável.
2. **Controles** — botões Sim/Não, avatares, campos do formulário e botão de
   avançar; ficam por cima da pele e se movem junto com a pill.
3. **Botão principal** — a área de clique estável.
4. **×** — preso ao espaço do botão, não à pill que se move.
5. **Bolinha minimizada** — em portal, fixa na tela.

### 4.4 Tempos e constantes principais

| O quê | Valor |
|-------|-------|
| Espera inicial | 4000 ms |
| Círculo com avatar antes de expandir | 850 ms |
| × aparece sozinho | 1500 ms após abrir |
| Recolhe sozinho | 5000 ms sem interação |
| Mensagem de quem atende | 2200 ms (celular: 1600 ms) |
| Celular: passa sozinho para "Falar agora!" | 1800 ms após abrir |
| Recolhe sozinho após reabertura | 10 000 ms |
| Saída do hover (pill escura cobre) | 510 ms |
| Recolher ao fechar | 540 ms |
| Spring de largura / seguir cursor | `stiffness 220, damping 21` |
| Spring do preenchimento | `245 / 20` (altura: `400 / 28`) |
| Spring do voo da bolinha | `190 / 24` (tamanho na descida: `230 / 17`) |

Todas ficam no topo do arquivo, com comentário.

### 4.5 Arquivos

```
app/
  page.tsx               raiz: mostra a demonstração
  demo/demo-stage.tsx    fundo simulado + botão Replay
  layout.tsx             fonte Urbanist
components/
  contact-button.tsx     o componente inteiro
lib/asset.ts             prefixo de caminho para o GitHub Pages
public/
  consultores/*.jpg      fotos recortadas (160×160)
  site-estoque*.jpg      prints usados como fundo da simulação
scripts/publish-pages.sh publicação no GitHub Pages
```

---

## 5. O que é simulação e o que falta

**Simulado nesta versão**

- **Plantão:** o consultor de plantão é sempre o primeiro da lista (Diego). Não
  há escala real.
- **Envio dos dados:** `onLead` só escreve no console. Nada é gravado nem
  enviado.
- **Fundo:** é um print estático da página de estoque, não o site.
- **Posição:** o botão está no centro da tela; a posição final no site ainda
  não foi definida.
- **Tamanho:** a demonstração amplia o botão (1,5× no computador, ajustado à
  largura no celular). O componente em si tem 48 px de altura.

**Limitações conhecidas**

- No formulário, o botão branco **Voltar** (embaixo da pill, a partir do
  segundo campo) retorna ao campo anterior com o que já foi digitado.
- Quem respondeu que **já é cliente** pode trocar de consultor durante o
  formulário: um selo branco com ícone de recarregar, no canto superior
  esquerdo do avatar, indica isso; tocar no avatar mostra **Escolher outro
  consultor** (some sozinho em 4 s); tocando nele, os avatares voltam para
  nova escolha e o formulário continua do campo em que estava. Quem respondeu
  "Não" é sempre atendido pelo plantão e não tem essa opção.
- Ainda não há como voltar à resposta "já é cliente?", nem corrigir depois de
  enviar.
- A conversa não é salva: recarregar a página recomeça do zero.
- A bolinha minimizada pousa no canto inferior direito, onde o site hoje tem o
  mascote. Os dois vão se sobrepor.
- Validações simples: nome com 2+ letras, formato de e-mail, telefone com 10+
  dígitos. Não há verificação real de e-mail ou número.
- Não há aviso de privacidade (LGPD) no formulário.
- No celular o fluxo foi testado só em emulação de iPhone no Chrome, não em um
  aparelho de verdade (teclado virtual, Safari).
- Não foi testado com leitor de tela. Os controles são botões e campos reais,
  com rótulos, mas falta respeitar a preferência de "reduzir movimento" do
  sistema.
- Em telas de toque não há hover: 1,8 s depois de abrir, o botão passa sozinho
  para "Falar agora!" e fica assim até ser tocado ou se recolher. O toque abre
  a pergunta direto.

---

## 6. Próxima fase: de protótipo a produto (proposta para discutir)

> Nada aqui está decidido nem construído. É a proposta levantada em 09/10/2026
> para servir de base à conversa.

A ideia: o botão virar um componente com área administrativa (escala dos
consultores, horário em que aparece, quando entra na tela) e que se aplique com
facilidade em qualquer site.

### 6.1 As três peças

**1. Widget embutível.** O botão empacotado em um único arquivo de script, que
o site instala colando uma linha, como um pixel ou um chat:

```html
<script src="https://seu-dominio/widget.js" data-conta="kiko-autos" async></script>
```

Funciona em qualquer site (WordPress, Wix, site próprio), sem depender de
Next.js nem de React do lado de lá. O widget se isola do CSS do site para um
não quebrar o outro.

**2. Painel admin.** Aplicação com login onde se define:

- consultores (foto, nome, WhatsApp) e a escala de plantão por dia e horário;
- o horário em que o botão aparece, e o que acontece fora dele;
- quando ele entra na tela (segundos, rolagem, páginas específicas), textos e
  cor;
- os contatos recebidos.

**3. API no meio.** O widget pergunta "quem está de plantão agora e qual a
configuração desta conta?" e envia o contato no fim. É aqui que entram o CRM e
o aviso ao consultor.

### 6.2 O que muda no código atual

O protótipo já recebe por configuração quase tudo isso (`consultants`, textos,
`startDelayMs`, `autoMinimizeMs`). Falta a configuração vir do painel.

- **Plantão:** hoje é sempre o primeiro da lista; passa a vir da escala.
- **Contato:** hoje `onLead` só escreve no console; passa a enviar para a API.
- **Empacotamento:** o componente usa recursos do Next (`next/image`,
  `next/font`) que precisam ser trocados por equivalentes simples. A animação
  não muda.

Os pontos de encaixe já existem: `onConsultant`, `onLead` e `onClose` são onde
as integrações se ligam, e `consultants` é por onde a escala entra.

### 6.3 Várias contas

Construindo desde o início para várias contas (cada site com seu
identificador), o mesmo sistema atende a Kiko Autos e depois outros clientes,
cada um com sua escala e seus textos.

### 6.4 Ordem sugerida

1. Widget embutível com a configuração em um arquivo, para colocar no site da
   Kiko e validar em uso real.
2. API com escala e contatos.
3. Painel admin.

Assim o cliente vê o botão funcionando no site antes de o painel existir.

### 6.5 Decisões em aberto

- **CRM:** qual é o da Kiko.
- **Aviso ao consultor:** como ele fica sabendo do contato (WhatsApp, e-mail,
  o próprio CRM).
- **Fora do horário:** o botão some ou continua coletando contato.
- **Posição no site:** onde o botão fica, e como convive com o mascote no
  canto inferior direito.
- **Privacidade (LGPD):** texto de consentimento no formulário e onde os dados
  ficam guardados.
