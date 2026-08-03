export type BlockType = "heading" | "paragraph" | "quote";

export interface Block {
  id: string;
  type: BlockType;
  html: string;
}

export interface Chapter {
  id: string;
  title: string;
  blocks: Block[];
}

export interface BookMeta {
  title: string;
  author: string;
}

export interface Toc {
  blocks: Block[];
}

export interface BookData {
  meta: BookMeta;
  intro: { blocks: Block[] };
  toc: Toc;
  chapters: Chapter[];
}

export const PLACEHOLDERS: Record<BlockType, string> = {
  paragraph: "لکھنا شروع کریں…",
  heading: "عنوان",
  quote: "اقتباس",
};

export function makeBlockId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function emptyBlock(type: BlockType = "paragraph"): Block {
  return { id: makeBlockId(), type, html: "" };
}

export function plainText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Constrains contenteditable output to text + <br> only, escaping everything else. */
export function sanitizeInlineHtml(raw: string): string {
  const container = document.createElement("div");
  container.innerHTML = raw;

  const walk = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? "");
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") return "<br>";
      const inner = Array.from(el.childNodes).map(walk).join("");
      if (el.tagName === "DIV" || el.tagName === "P") return inner + "<br>";
      return inner;
    }
    return "";
  };

  const result = Array.from(container.childNodes).map(walk).join("");
  return result.replace(/(<br>)+$/, "");
}
