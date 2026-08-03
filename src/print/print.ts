import { getBook } from "../api/client";
import { renderPreview } from "../preview/preview";

declare global {
  interface Window {
    __deadismPdfReady?: boolean;
    __deadismPdfError?: string;
  }
}

async function main() {
  const container = document.getElementById("print-root");
  if (!container) throw new Error("missing #print-root");
  const book = await getBook();
  await renderPreview(container, book);
  window.__deadismPdfReady = true;
}

main().catch((err) => {
  window.__deadismPdfError = String(err);
});
