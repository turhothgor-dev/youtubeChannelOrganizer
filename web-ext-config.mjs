// Configuración de web-ext (make up, make lint, make build): el paquete solo lleva el código de la
// extensión, no los ficheros del kit, la documentación ni las herramientas.
export default {
  ignoreFiles: [
    "AGENTS.md",
    "CLAUDE.md",
    "PROJECT.md",
    "Makefile",
    "Makefile.ps1",
    "format-md.ps1",
    "package.json",
    "package-lock.json",
    "web-ext-config.mjs",
    "ai",
    "docs",
    "web-ext-artifacts",
  ],
  build: {
    overwriteDest: true,
  },
};
