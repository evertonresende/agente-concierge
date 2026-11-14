// Import de arquivo como texto (`?raw`, do Vite), usado para ler o wrangler.jsonc no teste.
declare module "*?raw" {
  const texto: string;
  export default texto;
}
