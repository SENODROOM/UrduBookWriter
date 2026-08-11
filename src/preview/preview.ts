import { Previewer } from "pagedjs";
import baseCssUrl from "../styles/base.css?url";
import baseCssText from "../styles/base.css?raw";
import pagedCssUrl from "./pagedStyles.css?url";
import pagedCssText from "./pagedStyles.css?raw";
import { Block, BookData, escapeHtml } from "../editor/blocks";
import { fontStackFor } from "../editor/fonts";

// Paged.js fetches these by URL; under Vite's dev server a bare CSS URL
// returns an HMR-wrapped JS module, not raw CSS. Passing {url: cssText}
// pairs instead skips the fetch entirely, using the URL only to resolve
// relative asset references (e.g. the @font-face src) inside the sheet.
const STYLESHEETS = [{ [baseCssUrl]: baseCssText }, { [pagedCssUrl]: pagedCssText }];

function blockToHtml(block: Block): string {
  if (!block.html.trim()) return "";
  const attrs = `data-block-id="${block.id}" data-block-type="${block.type}"`;
  if (block.type === "heading") return `<h2 class="block-heading" ${attrs}>${block.html}</h2>`;
  if (block.type === "quote") return `<blockquote class="block-quote" ${attrs}>${block.html}</blockquote>`;
  return `<p class="block-paragraph" ${attrs}>${block.html}</p>`;
}

function blocksToHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join("\n");
}

function cssStringLiteral(text: string): string {
  return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function buildBookHtml(book: BookData): string {
  const title = escapeHtml(book.meta.title || "Deadism");
  const author = book.meta.author ? escapeHtml(book.meta.author) : "";

  const coverHtml = `
    <section class="ubw-frontmatter">
      <div class="ubw-cover">
        <div class="ubw-cover-title">${title}</div>
        ${author ? `<div class="ubw-cover-author">${author}</div>` : ""}
      </div>
    </section>`;

  const tocHtml = `
    <section class="ubw-frontmatter page-break">
      <div class="ubw-toc-title" dir="rtl" lang="ur">فہرست</div>
      <div class="ubw-flow" dir="rtl" lang="ur">
        ${blocksToHtml(book.toc.blocks)}
      </div>
    </section>`;

  const introHtml = `
    <section class="ubw-frontmatter page-break">
      <div class="ubw-intro-title" dir="rtl" lang="ur">مصنف کا تعارف</div>
      <div class="ubw-flow" dir="rtl" lang="ur">
        ${blocksToHtml(book.intro.blocks)}
      </div>
    </section>`;

  const chaptersHtml = book.chapters
    .map(
      (chapter) => `
      <section class="chapter chapter-break ubw-flow" dir="rtl" lang="ur" data-chapter-id="${chapter.id}">
        ${blocksToHtml(chapter.blocks)}
      </section>`
    )
    .join("\n");

  // NOTE: deliberately no dir="rtl" here -- Chromium's print/PDF pipeline
  // mirrors the whole page layout (margins, running content) for RTL-rooted
  // documents, which is correct for reflowable web pages but wrong here
  // since Paged.js has already computed physical left/right margins itself.
  // Individual text elements below still carry their own dir="rtl" for
  // correct bidi text rendering.
  return `<div class="ubw-book">${coverHtml}${tocHtml}${introHtml}<div class="ubw-content-flow">${chaptersHtml}</div></div>`;
}

/**
 * Header text/on-off and the chosen Urdu font are user settings (meta.json).
 * They're applied as CSS custom properties on the document root -- not on
 * the .ubw-book wrapper -- because Paged.js's margin boxes (running
 * header/footer) are generated as siblings outside the original content
 * tree once chunking happens, so only a root-level property reaches them.
 */
function applyRootStyleVars(book: BookData) {
  const root = document.documentElement.style;
  const headerText = book.meta.headerEnabled ? book.meta.headerText || "Deadism" : "";
  root.setProperty("--ubw-header-text", cssStringLiteral(headerText));
  root.setProperty(
    "--ubw-header-border",
    book.meta.headerEnabled ? "3px double var(--ubw-rule, #333)" : "none"
  );
  root.setProperty("--ubw-font", fontStackFor(book.meta.fontKey));
}

export async function renderPreview(container: HTMLElement, book: BookData) {
  container.innerHTML = "";
  applyRootStyleVars(book);
  const previewer = new Previewer();
  const html = buildBookHtml(book);
  const flow = await previewer.preview(html, STYLESHEETS, container);

  // Paged.js's own font wait can resolve before the Noto Nastaliq Urdu
  // @font-face has actually finished applying, letting the browser paint
  // with a fallback font (very different vertical metrics) right up until
  // the swap happens. If a caller (e.g. the PDF export's Puppeteer capture)
  // reads the layout before that swap, the fallback gets baked in
  // permanently. Wait for the Font Loading API directly, then give layout a
  // moment to settle after any reflow the swap causes.
  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 150));

  return flow;
}

/** True for pages in the main content flow (as opposed to front matter), i.e. pages that carry a visible page number. */
export function isContentPage(pageEl: Element): boolean {
  return pageEl.classList.contains("pagedjs_content_page");
}
