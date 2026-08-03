import { Block, BookData, BookMeta, Chapter } from "../editor/blocks";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${url} failed: ${res.status}`);
  return res.json();
}

export function getBook(): Promise<BookData> {
  return req("/api/book");
}

export function saveMeta(meta: BookMeta) {
  return req("/api/meta", { method: "PUT", body: JSON.stringify(meta) });
}

export function saveIntro(blocks: Block[]) {
  return req("/api/intro", { method: "PUT", body: JSON.stringify({ blocks }) });
}

export function saveToc(blocks: Block[]) {
  return req("/api/toc", { method: "PUT", body: JSON.stringify({ blocks }) });
}

export function saveChapter(id: string, blocks: Block[]) {
  return req(`/api/chapters/${id}`, { method: "PUT", body: JSON.stringify({ blocks }) });
}

export function createChapter(title: string): Promise<Chapter> {
  return req("/api/chapters", { method: "POST", body: JSON.stringify({ title }) });
}

export function deleteChapter(id: string) {
  return req(`/api/chapters/${id}`, { method: "DELETE" });
}

export function exportEpubUrl(): string {
  return "/api/export/epub";
}
