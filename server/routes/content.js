import express from "express";
import * as store from "../content-store.js";

export function contentRouter() {
  const router = express.Router();
  router.use(express.json({ limit: "10mb" }));

  router.get("/book", async (req, res, next) => {
    try {
      const [meta, intro, toc, chapters] = await Promise.all([
        store.readMeta(),
        store.readIntro(),
        store.readToc(),
        store.listChapters(),
      ]);
      res.json({ meta, intro, toc, chapters });
    } catch (err) {
      next(err);
    }
  });

  router.put("/meta", async (req, res, next) => {
    try {
      await store.writeMeta(req.body);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.put("/intro", async (req, res, next) => {
    try {
      await store.writeIntro(req.body);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.put("/toc", async (req, res, next) => {
    try {
      await store.writeToc(req.body);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/chapters", async (req, res, next) => {
    try {
      const chapter = await store.createChapter(req.body?.title ?? "");
      res.json(chapter);
    } catch (err) {
      next(err);
    }
  });

  router.put("/chapters/:id", async (req, res, next) => {
    try {
      await store.writeChapter(req.params.id, { blocks: req.body.blocks });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/chapters/:id", async (req, res, next) => {
    try {
      await store.deleteChapter(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
