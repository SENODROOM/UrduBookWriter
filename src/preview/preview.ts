import { Previewer } from "pagedjs";
import baseCssUrl from "../styles/base.css?url";
import pagedCssUrl from "./pagedStyles.css?url";
import { Block, BookData, escapeHtml } from "../editor/blocks";

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

  return `<div class="deadism-book">${coverHtml}${tocHtml}${introHtml}<div class="deadism-content-flow">${chaptersHtml}</div></div>`;
}

export async function renderPreview(container: HTMLElement, book: BookData) {
  container.innerHTML = "";
  const previewer = new Previewer();
  const html = buildBookHtml(book);
  const flow = await previewer.preview(html, [baseCssUrl, pagedCssUrl], container);
  return flow;
}

/** Reads the actually-rendered footer page number for a given page element (empty string on unnumbered/front-matter pages). */
export function renderedPageNumber(pageEl: Element): string {
  const box = pageEl.querySelector(".pagedjs_margin-bottom-right .pagedjs_margin-content");
  return box?.textContent?.trim() ?? "";
}
