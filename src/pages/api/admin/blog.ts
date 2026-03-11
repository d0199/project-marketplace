import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/auditLog";
import { blogStore } from "@/lib/blogStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method === "GET") {
    const posts = await blogStore.getAll();
    posts.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    return res.json(posts);
  }

  if (req.method === "POST") {
    const { slug, title, content, status } = req.body;
    if (!slug || !title || !content) {
      return res.status(400).json({ error: "slug, title, and content are required" });
    }
    // Check slug uniqueness
    const existing = await blogStore.getBySlug(slug);
    if (existing) {
      return res.status(409).json({ error: `Slug "${slug}" already exists` });
    }
    try {
      const post = await blogStore.create({
        ...req.body,
        status: status || "draft",
        authorName: req.body.authorName || "",
        authorEmail: req.body.authorEmail || adminEmail,
        tags: req.body.tags || [],
        publishedAt: status === "published" ? new Date().toISOString() : "",
      });
      logAdminAction({ adminEmail, action: "blog.create", entityType: "blog", entityId: post.id, entityName: title });
      return res.status(201).json(post);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[blog] Create failed:", msg, err);
      return res.status(500).json({ error: `Create failed: ${msg}` });
    }
  }

  if (req.method === "PUT") {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });
    const existing = await blogStore.getById(id);
    if (!existing) return res.status(404).json({ error: "Post not found" });

    // If publishing for the first time, set publishedAt
    const isNewlyPublished = req.body.status === "published" && existing.status !== "published";
    try {
      const post = await blogStore.update({
        ...existing,
        ...req.body,
        publishedAt: isNewlyPublished ? new Date().toISOString() : (req.body.publishedAt ?? existing.publishedAt),
      });
      logAdminAction({ adminEmail, action: "blog.update", entityType: "blog", entityId: post.id, entityName: post.title });
      return res.json(post);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[blog] Update failed:", msg, err);
      return res.status(500).json({ error: `Update failed: ${msg}` });
    }
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "id is required" });
    const existing = await blogStore.getById(id);
    await blogStore.delete(id);
    logAdminAction({ adminEmail, action: "blog.delete", entityType: "blog", entityId: id, entityName: existing?.title ?? id });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
