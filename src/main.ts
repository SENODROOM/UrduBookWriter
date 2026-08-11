import "./styles/base.css";
import "./styles/app.css";

import { BlockEditor } from "./editor/editor";
import { Block, BlockType, BookData, Chapter, plainText } from "./editor/blocks";
import { FONT_OPTIONS } from "./editor/fonts";
import { renderPreview } from "./preview/preview";
import { generateTocBlocks } from "./toc/generateToc";
import {
  createChapter,
  deleteChapter as apiDeleteChapter,
  exportEpubUrl,
  getBook,
  saveChapter,
  saveIntro,
  saveMeta,
  saveToc,
} from "./api/client";

type View =
  | { kind: "cover" }
  | { kind: "toc" }
  | { kind: "intro" }
  | { kind: "settings" }
  | { kind: "chapter"; id: string };

let book: BookData;
let currentView: View = { kind: "cover" };
let editor: BlockEditor | null = null;

let sidebarEl: HTMLElement;
let editorPaneEl: HTMLElement;
let previewEl: HTMLElement;

// --- save scheduling (debounced, single-flight, flushable) ---
let saveTimer: number | undefined;
let pendingSave: (() => void) | null = null;

function scheduleSave(fn: () => void) {
  pendingSave = fn;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 800);
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (pendingSave) {
    const fn = pendingSave;
    pendingSave = null;
    fn();
  }
}

function setStatus(text: string) {
  const el = document.getElementById("save-status-indicator");
  if (el) el.textContent = text;
}

async function persistMeta() {
  setStatus("Saving…");
  try {
    await saveMeta(book.meta);
    setStatus("Saved");
  } catch {
    setStatus("Save failed");
  }
}

async function persistToc() {
  setStatus("Saving…");
  try {
    await saveToc(book.toc.blocks);
    setStatus("Saved");
  } catch {
    setStatus("Save failed");
  }
}

async function persistIntro() {
  setStatus("Saving…");
  try {
    await saveIntro(book.intro.blocks);
    setStatus("Saved");
  } catch {
    setStatus("Save failed");
  }
}

async function persistChapter(id: string, blocks: Block[]) {
  setStatus("Saving…");
  try {
    await saveChapter(id, blocks);
    setStatus("Saved");
  } catch {
    setStatus("Save failed");
  }
}

// --- preview scheduling (debounced, single-flight) ---
let previewTimer: number | undefined;
let inFlightRender: Promise<void> | null = null;

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => runPreview(), 700);
}

/** Renders the preview from the current `book` state. If a render is already in flight, waits for it, then re-renders so the result reflects the latest state (callers can safely `await` a fresh render). */
function runPreview(): Promise<void> {
  if (inFlightRender) {
    return inFlightRender.then(() => runPreview());
  }
  inFlightRender = renderPreview(previewEl, book)
    .catch((err) => console.error("preview render failed", err))
    .finally(() => {
      inFlightRender = null;
    });
  return inFlightRender;
}

// --- helpers ---
function titleFromBlocks(blocks: Block[]): string {
  const heading = blocks.find((b) => b.type === "heading");
  const text = heading ? plainText(heading.html) : "";
  return text || "Untitled";
}

function navItem(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "nav-item" + (active ? " active" : "");
  btn.textContent = label;
  btn.onclick = onClick;
  return btn;
}

// --- sidebar ---
function renderSidebar() {
  sidebarEl.innerHTML = "";

  const h1 = document.createElement("h1");
  h1.textContent = "Urdu Book Writer";
  sidebarEl.appendChild(h1);

  sidebarEl.appendChild(navItem("Cover", currentView.kind === "cover", () => selectView({ kind: "cover" })));
  sidebarEl.appendChild(
    navItem("Table of Contents", currentView.kind === "toc", () => selectView({ kind: "toc" }))
  );
  sidebarEl.appendChild(navItem("Author Intro", currentView.kind === "intro", () => selectView({ kind: "intro" })));
  sidebarEl.appendChild(navItem("Settings", currentView.kind === "settings", () => selectView({ kind: "settings" })));

  const label = document.createElement("div");
  label.className = "nav-section-label";
  label.textContent = "Chapters";
  sidebarEl.appendChild(label);

  for (const chapter of book.chapters) {
    const row = document.createElement("div");
    row.className = "chapter-row";
    const active = currentView.kind === "chapter" && currentView.id === chapter.id;
    row.appendChild(navItem(chapter.title || "Untitled", active, () => selectView({ kind: "chapter", id: chapter.id })));

    const del = document.createElement("button");
    del.className = "delete-chapter";
    del.textContent = "×";
    del.title = "Delete chapter";
    del.onclick = (e) => {
      e.stopPropagation();
      handleDeleteChapter(chapter.id);
    };
    row.appendChild(del);

    sidebarEl.appendChild(row);
  }

  const addBtn = document.createElement("button");
  addBtn.className = "new-chapter-btn";
  addBtn.textContent = "+ New Chapter";
  addBtn.onclick = handleNewChapter;
  sidebarEl.appendChild(addBtn);

  const footer = document.createElement("div");
  footer.className = "sidebar-footer";

  const statusSpan = document.createElement("div");
  statusSpan.className = "save-status";
  statusSpan.id = "save-status-indicator";

  const pdfBtn = document.createElement("button");
  pdfBtn.className = "export-btn";
  pdfBtn.textContent = "Export PDF";
  pdfBtn.onclick = handleExportPdf;

  const epubBtn = document.createElement("button");
  epubBtn.className = "export-btn";
  epubBtn.textContent = "Export EPUB";
  epubBtn.onclick = handleExportEpub;

  footer.append(statusSpan, pdfBtn, epubBtn);
  sidebarEl.appendChild(footer);
}

// --- editor pane ---
function buildToolbar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "toolbar";

  const mkBtn = (label: string, type: BlockType) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.dataset.blockType = type;
    // Clicking a button moves focus off the contenteditable block first,
    // which collapses the selection setCurrentBlockType relies on -- block
    // that on mousedown so the caret position survives until click fires.
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      editor?.setCurrentBlockType(type);
      refreshToolbarActiveState();
    };
    return b;
  };

  bar.appendChild(mkBtn("Heading", "heading"));
  bar.appendChild(mkBtn("Quote", "quote"));

  return bar;
}

function refreshToolbarActiveState() {
  const type = editor?.getCurrentBlockType();
  editorPaneEl.querySelectorAll<HTMLButtonElement>(".toolbar button[data-block-type]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.blockType === type);
  });
}

function buildTocActions(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "toc-actions";
  const btn = document.createElement("button");
  btn.textContent = "Regenerate from Headings";
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Regenerating…";
    await runPreview();
    const newBlocks = generateTocBlocks(previewEl);
    book.toc.blocks = newBlocks;
    editor?.setBlocks(newBlocks);
    scheduleSave(persistToc);
    flushSave();
    btn.disabled = false;
    btn.textContent = "Regenerate from Headings";
  };
  bar.appendChild(btn);
  return bar;
}

function renderCoverForm() {
  const wrap = document.createElement("div");
  wrap.className = "editor-scroll";
  const form = document.createElement("div");
  form.className = "cover-form";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Book Title";
  const titleInput = document.createElement("input");
  titleInput.value = book.meta.title;
  titleInput.dir = "rtl";
  titleInput.oninput = () => {
    book.meta.title = titleInput.value;
    scheduleSave(persistMeta);
    schedulePreview();
  };
  titleLabel.appendChild(titleInput);

  const authorLabel = document.createElement("label");
  authorLabel.textContent = "Author Name";
  const authorInput = document.createElement("input");
  authorInput.value = book.meta.author;
  authorInput.dir = "rtl";
  authorInput.oninput = () => {
    book.meta.author = authorInput.value;
    scheduleSave(persistMeta);
    schedulePreview();
  };
  authorLabel.appendChild(authorInput);

  form.append(titleLabel, authorLabel);
  wrap.appendChild(form);
  editorPaneEl.appendChild(wrap);
}

function renderSettingsForm() {
  const wrap = document.createElement("div");
  wrap.className = "editor-scroll";
  const form = document.createElement("div");
  form.className = "cover-form";

  const headerEnabledLabel = document.createElement("label");
  headerEnabledLabel.className = "settings-checkbox-row";
  const headerEnabledInput = document.createElement("input");
  headerEnabledInput.type = "checkbox";
  headerEnabledInput.checked = book.meta.headerEnabled;
  const headerTextLabel = document.createElement("label");
  headerTextLabel.textContent = "Header text";
  const headerTextInput = document.createElement("input");
  headerTextInput.value = book.meta.headerText;
  headerTextInput.disabled = !book.meta.headerEnabled;
  headerTextInput.oninput = () => {
    book.meta.headerText = headerTextInput.value;
    scheduleSave(persistMeta);
    schedulePreview();
  };
  headerEnabledInput.onchange = () => {
    book.meta.headerEnabled = headerEnabledInput.checked;
    headerTextInput.disabled = !headerEnabledInput.checked;
    scheduleSave(persistMeta);
    schedulePreview();
  };
  headerEnabledLabel.append(headerEnabledInput, document.createTextNode(" Show running header on every page"));
  headerTextLabel.appendChild(headerTextInput);

  const fontLabel = document.createElement("label");
  fontLabel.textContent = "Book font";
  const fontSelect = document.createElement("select");
  for (const opt of FONT_OPTIONS) {
    const option = document.createElement("option");
    option.value = opt.key;
    option.textContent = opt.label;
    option.selected = opt.key === book.meta.fontKey;
    fontSelect.appendChild(option);
  }
  fontSelect.onchange = () => {
    book.meta.fontKey = fontSelect.value;
    scheduleSave(persistMeta);
    schedulePreview();
  };
  fontLabel.appendChild(fontSelect);

  const note = document.createElement("p");
  note.className = "settings-note";
  note.textContent = "The page number in the footer always shows and can't be turned off.";

  form.append(headerEnabledLabel, headerTextLabel, fontLabel, note);
  wrap.appendChild(form);
  editorPaneEl.appendChild(wrap);
}

function renderEditorPane() {
  editorPaneEl.innerHTML = "";
  editor = null;

  if (currentView.kind === "cover") {
    renderCoverForm();
    return;
  }

  if (currentView.kind === "settings") {
    renderSettingsForm();
    return;
  }

  editorPaneEl.appendChild(buildToolbar());
  if (currentView.kind === "toc") editorPaneEl.appendChild(buildTocActions());

  const scroll = document.createElement("div");
  scroll.className = "editor-scroll";
  const editorContainer = document.createElement("div");
  scroll.appendChild(editorContainer);
  editorPaneEl.appendChild(scroll);

  let blocks: Block[];
  let onChange: (blocks: Block[]) => void;

  if (currentView.kind === "toc") {
    blocks = book.toc.blocks;
    onChange = (b) => {
      book.toc.blocks = b;
      scheduleSave(persistToc);
      schedulePreview();
    };
  } else if (currentView.kind === "intro") {
    blocks = book.intro.blocks;
    onChange = (b) => {
      book.intro.blocks = b;
      scheduleSave(persistIntro);
      schedulePreview();
    };
  } else {
    const chapterId = currentView.id;
    const chapter = book.chapters.find((c) => c.id === chapterId) as Chapter;
    blocks = chapter.blocks;
    onChange = (b) => {
      chapter.blocks = b;
      const newTitle = titleFromBlocks(b);
      const titleChanged = newTitle !== chapter.title;
      chapter.title = newTitle;
      scheduleSave(() => persistChapter(chapter.id, b));
      schedulePreview();
      if (titleChanged) renderSidebar();
    };
  }

  editor = new BlockEditor(editorContainer, blocks, onChange);
  editorContainer.addEventListener("click", refreshToolbarActiveState);
  editorContainer.addEventListener("keyup", refreshToolbarActiveState);
  editor.focus();
  refreshToolbarActiveState();
}

function selectView(view: View) {
  flushSave();
  currentView = view;
  renderSidebar();
  renderEditorPane();
}

// --- chapter actions ---
async function handleNewChapter() {
  const chapter = await createChapter("");
  book.chapters.push(chapter);
  selectView({ kind: "chapter", id: chapter.id });
  schedulePreview();
}

async function handleDeleteChapter(id: string) {
  const chapter = book.chapters.find((c) => c.id === id);
  if (!chapter) return;
  if (!window.confirm(`Delete chapter "${chapter.title}"? This cannot be undone.`)) return;
  await apiDeleteChapter(id);
  book.chapters = book.chapters.filter((c) => c.id !== id);
  if (currentView.kind === "chapter" && currentView.id === id) {
    selectView({ kind: "cover" });
  } else {
    renderSidebar();
  }
  schedulePreview();
}

function handleExportPdf() {
  window.location.href = "/api/export/pdf";
}

function handleExportEpub() {
  window.location.href = exportEpubUrl();
}

// --- boot ---
function renderShell() {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  sidebarEl = document.createElement("div");
  sidebarEl.className = "sidebar";

  editorPaneEl = document.createElement("div");
  editorPaneEl.className = "editor-pane";

  const previewPane = document.createElement("div");
  previewPane.className = "preview-pane";
  const previewHeader = document.createElement("div");
  previewHeader.className = "preview-pane-header";
  previewHeader.textContent = "Live Preview — matches the exported PDF exactly";
  previewEl = document.createElement("div");
  previewPane.append(previewHeader, previewEl);

  app.append(sidebarEl, editorPaneEl, previewPane);
}

async function boot() {
  book = await getBook();
  renderShell();
  selectView({ kind: "cover" });
  runPreview();
}

boot();
