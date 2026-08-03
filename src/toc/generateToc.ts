import { Block, emptyBlock, makeBlockId } from "../editor/blocks";
import { isContentPage } from "../preview/preview";

/**
 * Walks the already-rendered Paged.js preview and builds TOC entries from
 * heading blocks. Page numbers are computed by counting content-flow pages
 * in order (the counter resets to 1 at content start and increments by one
 * per page) rather than reading the rendered footer text, since the page
 * number is painted via a CSS ::after pseudo-element and isn't part of the
 * DOM/textContent.
 */
export function generateTocBlocks(previewContainer: HTMLElement): Block[] {
  const seen = new Set<string>();
  const entries: { text: string; page: number }[] = [];
  let contentPageIndex = 0;

  const pages = Array.from(previewContainer.querySelectorAll(".pagedjs_page"));
  for (const pageEl of pages) {
    if (!isContentPage(pageEl)) continue;
    contentPageIndex += 1;

    const headings = pageEl.querySelectorAll('[data-block-type="heading"]');
    headings.forEach((h) => {
      const id = h.getAttribute("data-block-id") ?? "";
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      const text = h.textContent?.trim();
      if (text) entries.push({ text, page: contentPageIndex });
    });
  }

  if (!entries.length) return [emptyBlock("paragraph")];
  return entries.map((e): Block => ({
    id: makeBlockId(),
    type: "paragraph",
    html: `${e.text} — ${e.page}`,
  }));
}
