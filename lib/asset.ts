// No GitHub Pages o site fica em um subcaminho (/assistente_humano); arquivos
// de /public precisam desse prefixo. Localmente o prefixo é vazio.
export const asset = (path: string) =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
