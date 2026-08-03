import { Block, BlockType, PLACEHOLDERS, emptyBlock, makeBlockId, sanitizeInlineHtml } from "./blocks";

export class BlockEditor {
  private container: HTMLElement;
  private blocks: Block[];
  private onChange: (blocks: Block[]) => void;

  constructor(container: HTMLElement, initialBlocks: Block[], onChange: (blocks: Block[]) => void) {
    this.container = container;
    this.blocks = initialBlocks.length ? initialBlocks : [emptyBlock("heading")];
    this.onChange = onChange;

    this.container.setAttribute("contenteditable", "true");
    this.container.setAttribute("dir", "rtl");
    this.container.setAttribute("lang", "ur");
    this.container.classList.add("deadism-flow", "deadism-editor");

    this.render();
    this.container.addEventListener("input", this.handleInput);
    this.container.addEventListener("keydown", this.handleKeydown);
    this.container.addEventListener("paste", this.handlePaste);
  }

  getBlocks(): Block[] {
    return this.blocks;
  }

  setBlocks(blocks: Block[]) {
    this.blocks = blocks.length ? blocks : [emptyBlock("heading")];
    this.render();
  }

  /** Sets the type of the block containing the current caret; toggles back to paragraph if already that type. */
  setCurrentBlockType(type: BlockType) {
    const el = this.currentBlockEl();
    if (!el) return;
    const id = el.dataset.blockId!;
    const block = this.blocks.find((b) => b.id === id);
    if (!block) return;
    block.type = block.type === type ? "paragraph" : type;
    this.render();
    this.focusBlock(block.id, "end");
    this.emitChange();
  }

  getCurrentBlockType(): BlockType | null {
    const el = this.currentBlockEl();
    if (!el) return null;
    const block = this.blocks.find((b) => b.id === el.dataset.blockId);
    return block?.type ?? null;
  }

  focus() {
    if (this.blocks.length) this.focusBlock(this.blocks[0].id, "end");
  }

  private emitChange() {
    this.onChange(this.blocks);
  }

  private render() {
    this.container.innerHTML = "";
    for (const block of this.blocks) {
      this.container.appendChild(this.renderBlockEl(block));
    }
  }

  private renderBlockEl(block: Block): HTMLElement {
    const el = document.createElement("div");
    el.className = `block block-${block.type}`;
    el.dataset.blockId = block.id;
    el.dataset.blockType = block.type;
    el.innerHTML = block.html;
    this.updatePlaceholder(el, block);
    return el;
  }

  private updatePlaceholder(el: HTMLElement, block: Block) {
    const isEmpty = el.textContent?.trim().length === 0;
    el.classList.toggle("block-empty", !!isEmpty);
    if (isEmpty) el.dataset.placeholder = PLACEHOLDERS[block.type];
    else delete el.dataset.placeholder;
  }

  private currentBlockEl(): HTMLElement | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== this.container) {
      if (node instanceof HTMLElement && node.parentElement === this.container) return node;
      node = node.parentNode;
    }
    return null;
  }

  private focusBlock(id: string, where: "start" | "end") {
    const el = this.container.querySelector<HTMLElement>(`[data-block-id="${id}"]`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(where === "start");
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  private handleInput = (e: Event) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
    if (!target) return;
    const block = this.blocks.find((b) => b.id === target.dataset.blockId);
    if (!block) return;
    block.html = sanitizeInlineHtml(target.innerHTML);
    this.updatePlaceholder(target, block);
    this.emitChange();
  };

  private handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, text);
  };

  private handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.splitBlockAtCaret();
      return;
    }
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertHTML", false, "<br>");
      return;
    }
    if (e.key === "Backspace") {
      const el = this.currentBlockEl();
      if (el && this.caretAtStart(el) && this.blocks.length > 1) {
        e.preventDefault();
        this.mergeBlockWithPrevious(el);
      }
    }
  };

  private caretAtStart(el: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const probe = range.cloneRange();
    probe.selectNodeContents(el);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length === 0;
  }

  private splitBlockAtCaret() {
    const el = this.currentBlockEl();
    if (!el) return;
    const id = el.dataset.blockId!;
    const idx = this.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;

    const sel = window.getSelection();
    const range = sel?.getRangeAt(0);
    let beforeHtml = el.innerHTML;
    let afterHtml = "";
    if (range) {
      const afterRange = range.cloneRange();
      afterRange.selectNodeContents(el);
      afterRange.setStart(range.endContainer, range.endOffset);
      const afterFragment = afterRange.extractContents();
      const wrapper = document.createElement("div");
      wrapper.appendChild(afterFragment);
      afterHtml = sanitizeInlineHtml(wrapper.innerHTML);
      beforeHtml = sanitizeInlineHtml(el.innerHTML);
    }

    this.blocks[idx].html = beforeHtml;
    const newBlock: Block = { id: makeBlockId(), type: "paragraph", html: afterHtml };
    this.blocks.splice(idx + 1, 0, newBlock);
    this.render();
    this.focusBlock(newBlock.id, "start");
    this.emitChange();
  }

  private mergeBlockWithPrevious(el: HTMLElement) {
    const id = el.dataset.blockId!;
    const idx = this.blocks.findIndex((b) => b.id === id);
    if (idx <= 0) return;
    const prev = this.blocks[idx - 1];
    const current = this.blocks[idx];
    const mergePointLength = prev.html.length;
    prev.html = prev.html + (current.html ? (prev.html ? "<br>" : "") + current.html : "");
    this.blocks.splice(idx, 1);
    this.render();
    this.focusBlockAtOffset(prev.id, mergePointLength);
    this.emitChange();
  }

  private focusBlockAtOffset(id: string, _htmlOffset: number) {
    // Best-effort: place caret at end of the previous block's original content.
    this.focusBlock(id, "end");
  }
}
