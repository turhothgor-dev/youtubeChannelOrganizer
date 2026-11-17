"use strict";

/**
 * Script de fondo mínimo: abre la página de opciones (editor de grupos) cuando
 * un script de contenido lo pide.
 */
browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "youtube-groups:open-editor") {
    return browser.runtime.openOptionsPage();
  }
  return undefined;
});
