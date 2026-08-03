import { Previewer } from "pagedjs";
import baseCssUrl from "../styles/base.css?url";
import baseCssText from "../styles/base.css?raw";
import pagedCssUrl from "./pagedStyles.css?url";
import pagedCssText from "./pagedStyles.css?raw";
import { Block, BookData, escapeHtml } from "../editor/blocks";

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

export function buildBookHtml(book: BookData): string {
  const title = escapeHtml(book.meta.title || "Deadism");
  const author = book.meta.author ? escapeHtml(book.meta.author) : "";

  const coverHtml = `
    <section class="deadism-frontmatter">
      <div class="deadism-cover">
        <div class="deadism-cover-title">${title}</div>
        ${author ? `<div class="deadism-cover-author">${author}</div>` : ""}
      </div>
    </section>`;

  const tocHtml = `
    <section class="deadism-frontmatter page-break">
      <div class="deadism-toc-title" dir="rtl" lang="ur">فہرست</div>
      <div class="deadism-flow" dir="rtl" lang="ur">
        ${blocksToHtml(book.toc.blocks)}
      </div>
    </section>`;

  const introHtml = `
    <section class="deadism-frontmatter page-break">
      <div class="deadism-intro-title" dir="rtl" lang="ur">مصنف کا تعارف</div>
      <div class="deadism-flow" dir="rtl" lang="ur">
        ${blocksToHtml(book.intro.blocks)}
      </div>
    </section>`;

  const chaptersHtml = book.chapters
    .map(
      (chapter) => `
      <section class="chapter chapter-break deadism-flow" dir="rtl" lang="ur" data-chapter-id="${chapter.id}">
        ${blocksToHtml(chapter.blocks)}
      </section>`
    )
    .join("\n");

  return `<div class="deadism-book" dir="rtl">${coverHtml}${tocHtml}${introHtml}<div class="deadism-content-flow">${chaptersHtml}</div></div>`;
}

export async function renderPreview(container: HTMLElement, book: BookData) {
  container.innerHTML = "";
  const previewer = new Previewer();
  const html = buildBookHtml(book);
  const flow = await previewer.preview(html, STYLESHEETS, container);
  return flow;
}

/** True for pages in the main content flow (as opposed to front matter), i.e. pages that carry a visible page number. */
export function isContentPage(pageEl: Element): boolean {
  return pageEl.classList.contains("pagedjs_content_page");
}
