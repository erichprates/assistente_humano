# Assistente humano

Protótipo de um botão animado de atendimento ("Tem um consultor humano
disponível"), feito em Next.js, [Motion](https://motion.dev) e Tailwind.

**Demonstração:** https://erichprates.github.io/assistente_humano/

O botão aparece depois de 4 segundos, reage ao cursor, pergunta se a pessoa já
é cliente, deixa escolher o consultor, pede nome, e-mail e WhatsApp e pode ser
minimizado para o canto da tela. É um protótipo de interface: nenhum dado é
enviado.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Documentação

O [manual](docs/MANUAL.md) descreve o fluxo completo, as opções do componente,
como a animação foi construída e o que ficou em aberto para a próxima fase.

## Publicar

```bash
npm run publish:pages
```
