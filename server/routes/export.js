import express from "express";
import { buildEpub } from "../epub/buildEpub.js";

let browserPromise;
async function getBrowser() {
  if (!browserPromise) {
    const { default: puppeteer } = await import("puppeteer");
    browserPromise = puppeteer.launch({ headless: true });
  }
  return browserPromise;
}

export function exportRouter() {
  const router = express.Router();

  router.get("/export/pdf", async (req, res, next) => {
    let page;
    try {
      const origin = `${req.protocol}://${req.get("host")}`;
      const browser = await getBrowser();
      page = await browser.newPage();

      await page.goto(`${origin}/print.html`, { waitUntil: "networkidle0", timeout: 60000 });
      await page.waitForFunction(
        "window.__deadismPdfReady === true || !!window.__deadismPdfError",
        { timeout: 60000 }
      );
      const renderError = await page.evaluate(() => window.__deadismPdfError);
      if (renderError) throw new Error(`Preview render failed: ${renderError}`);

      const pdf = await page.pdf({
        width: "5.5in",
        height: "8.5in",
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: "0in", bottom: "0in", left: "0in", right: "0in" },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="Deadism.pdf"');
      res.send(pdf);
    } catch (err) {
      next(err);
    } finally {
      if (page) await page.close();
    }
  });

  router.get("/export/epub", async (req, res, next) => {
    try {
      const buffer = await buildEpub();
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", 'attachment; filename="Deadism.epub"');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
