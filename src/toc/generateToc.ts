import { Block, emptyBlock, makeBlockId } from "../editor/blocks";
import { renderedPageNumber } from "../preview/preview";

/** Walks the already-rendered Paged.js preview and builds TOC entries from heading blocks, using the actual rendered (post counter-reset) page numbers. */
export function generateTocBlocks(previewContainer: HTMLElement): Block[] {
  const seen = new Set<string>();
  const entries: { text: string; page: string }[] = [];

  const pages = Array.from(previewContainer.querySelectorAll(".pagedjs_page"));
  for (const page of pages) {
    const pageNum = renderedPageNumber(page);
    if (!pageNum) continue; // front-matter pages render no page number

    const headings = page.querySelectorAll('[data-block-type="heading"]');
    headings.forEach((h) => {
      const id = h.getAttribute("data-block-id") ?? "";
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      const text = h.textContent?.trim();
      if (text) entries.push({ text, page: pageNum });
    });
  }

  if (!entries.length) return [emptyBlock("paragraph")];
  return entries.map((e): Block => ({
    id: makeBlockId(),
    type: "paragraph",
    html: `${e.text} — ${e.page}`,
  }));
}
