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

  // pagedStyles.css keeps a visible on-screen gap/shadow between pages for
  // the editor's live preview; strip it here via inline style (which wins
  // the cascade unconditionally) so the PDF capture is edge-to-edge with no
  // seams between physical pages. @media print inside a Paged.js-processed
  // stylesheet doesn't survive Paged.js's own CSS rewriting, so this can't
  // be done in pagedStyles.css itself.
  const pagesWrap = container.querySelector<HTMLElement>(".pagedjs_pages");
  if (pagesWrap) {
    pagesWrap.style.gap = "0";
    pagesWrap.style.padding = "0";
  }
  container.querySelectorAll<HTMLElement>(".pagedjs_page").forEach((el) => {
    el.style.boxShadow = "none";
  });

  window.__deadismPdfReady = true;
}

main().catch((err) => {
  window.__deadismPdfError = String(err);
});
