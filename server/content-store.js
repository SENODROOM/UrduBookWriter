import { promises as fs } from "node:fs";
import path from "node:path";

const CONTENT_DIR = path.resolve(process.cwd(), "content");
const CHAPTERS_DIR = path.join(CONTENT_DIR, "chapters");
const META_PATH = path.join(CONTENT_DIR, "meta.json");
const INTRO_PATH = path.join(CONTENT_DIR, "intro.json");
const TOC_PATH = path.join(CONTENT_DIR, "toc.json");

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function readMeta() {
  return readJson(META_PATH, { title: "Deadism", author: "" });
}

export function writeMeta(meta) {
  return writeJson(META_PATH, meta);
}

export function readIntro() {
  return readJson(INTRO_PATH, { blocks: [] });
}

export function writeIntro(intro) {
  return writeJson(INTRO_PATH, intro);
}

export function readToc() {
  return readJson(TOC_PATH, { blocks: [] });
}

export function writeToc(toc) {
  return writeJson(TOC_PATH, toc);
}

function slugify(text) {
  const slug = (text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return slug || "untitled";
}

async function listChapterFiles() {
  await fs.mkdir(CHAPTERS_DIR, { recursive: true });
  const files = await fs.readdir(CHAPTERS_DIR);
  return files.filter((f) => f.endsWith(".json")).sort();
}

function titleFromBlocks(blocks) {
  const heading = (blocks || []).find((b) => b.type === "heading");
  if (!heading) return "Untitled";
  const text = heading.html.replace(/<[^>]+>/g, "").trim();
  return text || "Untitled";
}

export async function listChapters() {
  const files = await listChapterFiles();
  const chapters = [];
  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    const data = await readJson(path.join(CHAPTERS_DIR, file), { blocks: [] });
    chapters.push({ id, title: titleFromBlocks(data.blocks), blocks: data.blocks });
  }
  return chapters;
}

export function readChapter(id) {
  return readJson(path.join(CHAPTERS_DIR, `${id}.json`), null);
}

export function writeChapter(id, data) {
  return writeJson(path.join(CHAPTERS_DIR, `${id}.json`), data);
}

export async function createChapter(title) {
  const files = await listChapterFiles();
  const maxOrder = files.reduce((max, f) => {
    const n = parseInt(f.slice(0, 3), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const order = maxOrder + 1;
  const id = `${String(order).padStart(3, "0")}-${slugify(title)}`;
  const blocks = title
    ? [{ id: cryptoRandomId(), type: "heading", html: title }]
    : [{ id: cryptoRandomId(), type: "heading", html: "" }];
  await writeChapter(id, { blocks });
  return { id, title: title || "Untitled", blocks };
}

export async function deleteChapter(id) {
  await fs.rm(path.join(CHAPTERS_DIR, `${id}.json`), { force: true });
}

export function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
