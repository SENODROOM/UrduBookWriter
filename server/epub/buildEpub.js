import archiver from "archiver";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import * as store from "../content-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname, "../../src/assets/fonts");

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function blockHtmlToXhtml(html) {
  return html.replace(/<br\s*\/?>/gi, "<br/>");
}

function blocksToXhtml(blocks) {
  return (blocks || [])
    .filter((b) => b.html && b.html.replace(/<br\s*\/?>/gi, "").trim().length > 0)
    .map((b) => {
      const inner = blockHtmlToXhtml(b.html);
      if (b.type === "heading") return `<h2 class="block-heading">${inner}</h2>`;
      if (b.type === "quote") return `<blockquote class="block-quote"><p>${inner}</p></blockquote>`;
      return `<p class="block-paragraph">${inner}</p>`;
    })
    .join("\n");
}

function xhtmlDoc(title, bodyHtml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ur" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="../css/style.css"/>
</head>
<body dir="rtl">
${bodyHtml}
</body>
</html>`;
}

const STYLE_CSS = `
@font-face {
  font-family: "Noto Nastaliq Urdu";
  font-weight: 400;
  font-style: normal;
  src: url("../fonts/NotoNastaliqUrdu-Regular.woff2") format("woff2");
}
@font-face {
  font-family: "Noto Nastaliq Urdu";
  font-weight: 700;
  font-style: normal;
  src: url("../fonts/NotoNastaliqUrdu-Bold.woff2") format("woff2");
}
body {
  font-family: "Noto Nastaliq Urdu", serif;
  font-size: 1.15em;
  line-height: 2.1;
  direction: rtl;
  margin: 5%;
}
h1, h2.block-heading {
  font-weight: 700;
  text-align: center;
}
h2.block-heading { font-size: 1.5em; margin: 1.6em 0 1em; }
p.block-paragraph { margin: 0 0 1em; text-align: justify; }
blockquote.block-quote {
  margin: 1.3em 2.2em;
  padding-inline-end: 1em;
  border-inline-end: 3px solid #333;
  font-weight: 500;
  text-align: right;
}
.deadism-cover-title { font-weight: 700; font-size: 2em; text-align: center; margin-top: 35%; }
.deadism-cover-author { text-align: center; margin-top: 1em; font-size: 1.1em; }
`;

export async function buildEpub() {
  const [meta, intro, chapters] = await Promise.all([
    store.readMeta(),
    store.readIntro(),
    store.listChapters(),
  ]);

  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks = [];
  archive.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    archive.on("end", resolve);
    archive.on("error", reject);
  });

  archive.append("application/epub+zip", { name: "mimetype", store: true });

  archive.append(
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    { name: "META-INF/container.xml" }
  );

  archive.append(STYLE_CSS, { name: "OEBPS/css/style.css" });

  const [regularFont, boldFont] = await Promise.all([
    fs.readFile(path.join(FONT_DIR, "NotoNastaliqUrdu-Regular.woff2")),
    fs.readFile(path.join(FONT_DIR, "NotoNastaliqUrdu-Bold.woff2")),
  ]);
  archive.append(regularFont, { name: "OEBPS/fonts/NotoNastaliqUrdu-Regular.woff2" });
  archive.append(boldFont, { name: "OEBPS/fonts/NotoNastaliqUrdu-Bold.woff2" });

  const title = meta.title || "Deadism";
  const coverBody = `<div class="deadism-cover-title">${escapeXml(title)}</div>${
    meta.author ? `<div class="deadism-cover-author">${escapeXml(meta.author)}</div>` : ""
  }`;
  archive.append(xhtmlDoc(title, coverBody), { name: "OEBPS/text/cover.xhtml" });

  const introBody = `<h1>مصنف کا تعارف</h1>\n${blocksToXhtml(intro.blocks)}`;
  archive.append(xhtmlDoc("Author Intro", introBody), { name: "OEBPS/text/intro.xhtml" });

  const chapterFiles = chapters.map((chapter, i) => ({
    id: `chapter-${String(i + 1).padStart(3, "0")}`,
    filename: `chapter-${String(i + 1).padStart(3, "0")}.xhtml`,
    chapter,
  }));

  for (const { filename, chapter } of chapterFiles) {
    const body = blocksToXhtml(chapter.blocks);
    archive.append(xhtmlDoc(chapter.title, body), { name: `OEBPS/text/${filename}` });
  }

  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="css/style.css" media-type="text/css"/>`,
    `<item id="font-regular" href="fonts/NotoNastaliqUrdu-Regular.woff2" media-type="font/woff2"/>`,
    `<item id="font-bold" href="fonts/NotoNastaliqUrdu-Bold.woff2" media-type="font/woff2"/>`,
    `<item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="intro" href="text/intro.xhtml" media-type="application/xhtml+xml"/>`,
    ...chapterFiles.map(
      ({ id, filename }) => `<item id="${id}" href="text/${filename}" media-type="application/xhtml+xml"/>`
    ),
  ].join("\n    ");

  const spineItems = [
    `<itemref idref="cover"/>`,
    `<itemref idref="intro"/>`,
    ...chapterFiles.map(({ id }) => `<itemref idref="${id}"/>`),
  ].join("\n    ");

  const navList = [
    `<li><a href="text/cover.xhtml">${escapeXml(title)}</a></li>`,
    `<li><a href="text/intro.xhtml">مصنف کا تعارف</a></li>`,
    ...chapterFiles.map(
      ({ filename, chapter }) => `<li><a href="text/${filename}">${escapeXml(chapter.title)}</a></li>`
    ),
  ].join("\n      ");

  const uuid = "urn:uuid:" + randomUUID();
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="ur">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>ur</dc:language>
    ${meta.author ? `<dc:creator>${escapeXml(meta.author)}</dc:creator>` : ""}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine page-progression-direction="rtl">
    ${spineItems}
  </spine>
</package>`;

  archive.append(opf, { name: "OEBPS/content.opf" });

  const nav = xhtmlDoc(
    "Table of Contents",
    `<nav epub:type="toc" id="toc"><h1>فہرست</h1><ol>\n      ${navList}\n    </ol></nav>`
  );
  archive.append(nav, { name: "OEBPS/nav.xhtml" });

  archive.finalize();
  await done;
  return Buffer.concat(chunks);
}
