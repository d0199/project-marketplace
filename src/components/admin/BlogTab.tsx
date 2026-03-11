import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { adminFetch } from "@/lib/adminFetch";
import type { BlogPost } from "@/lib/blogStore";

const BlogEditor = dynamic(() => import("./BlogEditor"), { ssr: false });

interface Props {
  adminEmail: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";

type AiAction = "title" | "excerpt" | "content" | "tags" | "seo";
const MAX_AI_CALLS = 3;

export default function BlogTab({ adminEmail }: Props) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<{ post: BlogPost; isNew: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [aiCallsUsed, setAiCallsUsed] = useState(0);
  const [aiLoading, setAiLoading] = useState<AiAction | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ action: AiAction; result: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/blog");
      const data = await r.json();
      if (Array.isArray(data)) setPosts(data);
    } catch { /* */ }
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function newPost(): BlogPost {
    return {
      id: "", slug: "", title: "", excerpt: "", content: "",
      coverImage: "", coverImageAlt: "", authorName: "", authorEmail: adminEmail,
      tags: [], status: "draft", publishedAt: "", seoTitle: "", seoDescription: "",
    };
  }

  const filtered = posts.filter((p) => {
    if (filter === "published" && p.status !== "published") return false;
    if (filter === "draft" && p.status !== "draft") return false;
    if (filter === "archived" && p.status !== "archived") return false;
    return true;
  });

  async function handleSave() {
    if (!panel) return;
    const { post, isNew } = panel;
    if (!post.title.trim() || !post.content.trim()) {
      showToast("Title and content are required");
      return;
    }
    if (!post.slug.trim()) post.slug = slugify(post.title);
    try {
      if (isNew) {
        const r = await adminFetch("/api/admin/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(post),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          showToast(err.error || "Create failed");
          return;
        }
      } else {
        const r = await adminFetch("/api/admin/blog", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(post),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          showToast(err.error || "Update failed");
          return;
        }
      }
      setPanel(null);
      setPreview(false);
      setAiCallsUsed(0);
      setAiSuggestions(null);
      showToast(isNew ? "Post created" : "Post updated");
      load();
    } catch {
      showToast("Save failed");
    }
  }

  async function handleDelete(id: string) {
    try {
      await adminFetch(`/api/admin/blog?id=${id}`, { method: "DELETE" });
      setConfirmDelete(null);
      setPanel(null);
      showToast("Post deleted");
      load();
    } catch {
      showToast("Delete failed");
    }
  }

  const update = useCallback((fields: Partial<BlogPost>) => {
    setPanel((prev) => prev ? { ...prev, post: { ...prev.post, ...fields } } : prev);
  }, []);

  async function callAi(action: AiAction) {
    if (!panel || aiCallsUsed >= MAX_AI_CALLS) {
      showToast(`AI limit reached (${MAX_AI_CALLS} per document)`);
      return;
    }
    const { post } = panel;
    let context = "";
    switch (action) {
      case "title":
        context = post.content || post.excerpt || post.title || "fitness gym blog post";
        break;
      case "excerpt":
        context = (post.title + "\n\n" + post.content).slice(0, 3000);
        break;
      case "content":
        context = post.title + (post.excerpt ? "\n\n" + post.excerpt : "") + (post.content ? "\n\nExisting content:\n" + post.content : "");
        break;
      case "tags":
        context = (post.title + "\n\n" + post.content).slice(0, 3000);
        break;
      case "seo":
        context = (post.title + "\n\n" + post.excerpt + "\n\n" + post.content).slice(0, 3000);
        break;
    }

    setAiLoading(action);
    try {
      const r = await adminFetch("/api/admin/blog-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, context }),
      });
      const data = await r.json();
      if (!r.ok) {
        showToast(data.error || "AI request failed");
        setAiLoading(null);
        return;
      }
      setAiCallsUsed((c) => c + 1);
      setAiSuggestions({ action, result: data.result });

      // Auto-apply for some actions
      if (action === "tags") {
        try {
          const tags = JSON.parse(data.result);
          if (Array.isArray(tags)) {
            setAiSuggestions({ action: "tags", result: JSON.stringify(tags) });
          }
        } catch { /* show raw result */ }
      } else if (action === "seo") {
        try {
          const seo = JSON.parse(data.result);
          if (seo.seoTitle || seo.seoDescription) {
            setAiSuggestions({ action: "seo", result: JSON.stringify(seo) });
          }
        } catch { /* show raw result */ }
      }
    } catch {
      showToast("AI request failed");
    }
    setAiLoading(null);
  }

  function applyAiSuggestion() {
    if (!aiSuggestions || !panel) return;
    const { action, result } = aiSuggestions;
    switch (action) {
      case "title": {
        // Take first suggestion
        const first = result.split("\n").find((l) => l.trim())?.replace(/^\d+\.\s*/, "").trim();
        if (first) update({ title: first });
        break;
      }
      case "excerpt":
        update({ excerpt: result.trim() });
        break;
      case "content":
        update({ content: panel.post.content + result });
        break;
      case "tags": {
        try {
          const tags = JSON.parse(result);
          if (Array.isArray(tags)) update({ tags: [...new Set([...panel.post.tags, ...tags])] });
        } catch { /* ignore */ }
        break;
      }
      case "seo": {
        try {
          const seo = JSON.parse(result);
          update({ seoTitle: seo.seoTitle || panel.post.seoTitle, seoDescription: seo.seoDescription || panel.post.seoDescription });
        } catch { /* ignore */ }
        break;
      }
    }
    setAiSuggestions(null);
  }

  function AiButton({ action, label }: { action: AiAction; label: string }) {
    const disabled = aiCallsUsed >= MAX_AI_CALLS || aiLoading !== null;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => callAi(action)}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
          disabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
        }`}
      >
        {aiLoading === action ? (
          <span className="inline-block w-3 h-3 border-2 border-purple-300 border-t-purple-700 rounded-full animate-spin" />
        ) : (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4m-7-7H1m22 0h-4M5.6 5.6l2.8 2.8m7.2 7.2l2.8 2.8m0-12.8l-2.8 2.8M8.4 15.6l-2.8 2.8" strokeLinecap="round" /></svg>
        )}
        {label}
      </button>
    );
  }

  // ---------- EDIT PANEL ----------
  if (panel) {
    const { post, isNew } = panel;
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">{isNew ? "New Blog Post" : `Edit: ${post.title || "Untitled"}`}</h2>
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
              AI: {aiCallsUsed}/{MAX_AI_CALLS}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview(!preview)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg"
            >
              {preview ? "Edit" : "Preview"}
            </button>
            <button onClick={() => { setPanel(null); setPreview(false); setAiCallsUsed(0); setAiSuggestions(null); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg">
              {isNew ? "Create" : "Save"}
            </button>
          </div>
        </div>

        {/* AI Suggestion Banner */}
        {aiSuggestions && (
          <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">AI Suggestion — {aiSuggestions.action}</p>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{aiSuggestions.result}</pre>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={applyAiSuggestion} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg">
                  Apply
                </button>
                <button onClick={() => setAiSuggestions(null)} className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-600 text-xs font-medium rounded-lg border border-gray-200">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {preview ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-3xl mx-auto">
            <p className="text-sm text-gray-400 mb-2">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" }) : "Draft"}</p>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{post.title || "Untitled"}</h1>
            {post.excerpt && <p className="text-lg text-gray-500 mb-6">{post.excerpt}</p>}
            {post.coverImage && (
              <div className="mb-6 rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.coverImage} alt={post.coverImageAlt || post.title} className="w-full h-auto rounded-xl" />
              </div>
            )}
            {post.authorName && <p className="text-sm text-gray-400 mb-6">By {post.authorName}</p>}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {post.tags.map((t) => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            )}
            <div
              className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-brand-orange prose-li:text-gray-700 prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Main content — 2 cols */}
            <div className="col-span-2 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Title</label>
                  <AiButton action="title" label="Suggest titles" />
                </div>
                <input className={inputCls} value={post.title} onChange={(e) => {
                  const title = e.target.value;
                  const autoSlug = isNew && (!post.slug || post.slug === slugify(panel.post.title));
                  update({ title, ...(autoSlug ? { slug: slugify(title) } : {}) });
                }} placeholder="Post title" />
              </div>
              <div>
                <label className={labelCls}>Slug</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">/blog/</span>
                  <input className={inputCls} value={post.slug} onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="url-slug" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Excerpt <span className="text-gray-400 font-normal">(also used as meta description)</span></label>
                  <AiButton action="excerpt" label="Generate excerpt" />
                </div>
                <textarea className={inputCls + " resize-none"} rows={2} value={post.excerpt} onChange={(e) => update({ excerpt: e.target.value })} placeholder="Brief summary (120-155 chars ideal)" />
                <p className="text-xs text-gray-400 mt-1">{post.excerpt.length}/155 characters</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Content</label>
                  <AiButton action="content" label="Write with AI" />
                </div>
                <BlogEditor content={post.content} onChange={(html) => update({ content: html })} />
              </div>
            </div>

            {/* Sidebar — 1 col */}
            <div className="space-y-4">
              {/* Status */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Publish</h3>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={post.status} onChange={(e) => update({ status: e.target.value as BlogPost["status"] })}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                {post.publishedAt && (
                  <p className="text-xs text-gray-400">Published: {new Date(post.publishedAt).toLocaleString("en-AU")}</p>
                )}
              </div>

              {/* Author */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Author</h3>
                <div>
                  <label className={labelCls}>Name</label>
                  <input className={inputCls} value={post.authorName} onChange={(e) => update({ authorName: e.target.value })} placeholder="Author name" />
                </div>
              </div>

              {/* SEO */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">SEO Overrides</h3>
                  <AiButton action="seo" label="AI SEO" />
                </div>
                <div>
                  <label className={labelCls}>SEO Title <span className="text-gray-400 font-normal">(leave blank for default)</span></label>
                  <input className={inputCls} value={post.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} placeholder={post.title ? `${post.title} — mynextgym.com.au` : "SEO title"} />
                  <p className="text-xs text-gray-400 mt-1">{(post.seoTitle || `${post.title} — mynextgym.com.au`).length}/60</p>
                </div>
                <div>
                  <label className={labelCls}>SEO Description</label>
                  <textarea className={inputCls + " resize-none"} rows={2} value={post.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} placeholder="Override excerpt for meta description" />
                </div>
              </div>

              {/* Cover Image */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Cover Image</h3>
                {post.coverImage && (
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.coverImage} alt={post.coverImageAlt || "Cover"} className="w-full h-32 object-cover" />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Image URL</label>
                  <input className={inputCls} value={post.coverImage} onChange={(e) => update({ coverImage: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className={labelCls}>Alt text</label>
                  <input className={inputCls} value={post.coverImageAlt} onChange={(e) => update({ coverImageAlt: e.target.value })} placeholder="Describe the image" />
                </div>
              </div>

              {/* Tags */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Tags</h3>
                  <AiButton action="tags" label="Suggest tags" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag, i) => (
                    <span key={i} className="text-xs bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-full flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => update({ tags: post.tags.filter((_, j) => j !== i) })}
                        className="text-gray-400 hover:text-red-500"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  className={inputCls}
                  placeholder="Add tag and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !post.tags.includes(val)) {
                        update({ tags: [...post.tags, val] });
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
              </div>

              {/* Delete */}
              {!isNew && (
                <button
                  onClick={() => setConfirmDelete(post.id)}
                  className="w-full px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
                >
                  Delete post
                </button>
              )}
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="font-semibold text-gray-900 mb-2">Delete this post?</h3>
              <p className="text-sm text-gray-500 mb-4">This action cannot be undone. Consider archiving instead.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">{toast}</div>}
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All posts</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="archived">Archived</option>
        </select>
        <span className="text-sm text-gray-400">{filtered.length} post{filtered.length !== 1 ? "s" : ""}</span>
        <div className="flex-1" />
        <button
          onClick={() => { setPanel({ post: newPost(), isNew: true }); setAiCallsUsed(0); setAiSuggestions(null); }}
          className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg whitespace-nowrap"
        >
          + New Post
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No blog posts yet. Create your first post to get started.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 font-medium">Title</th>
              <th className="py-2 font-medium">Slug</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Author</th>
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((post) => (
              <tr key={post.id} className="border-b hover:bg-gray-50">
                <td className="py-2.5 font-medium text-gray-900">{post.title}</td>
                <td className="py-2.5 text-gray-500 font-mono text-xs">/blog/{post.slug}</td>
                <td className="py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    post.status === "published" ? "bg-green-100 text-green-700"
                      : post.status === "archived" ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {post.status}
                  </span>
                </td>
                <td className="py-2.5 text-gray-500">{post.authorName || "—"}</td>
                <td className="py-2.5 text-gray-400 text-xs">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-AU") : post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-AU") : "—"}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPanel({ post: { ...post }, isNew: false }); setAiCallsUsed(0); setAiSuggestions(null); }}
                      className="text-brand-orange hover:text-brand-orange-dark font-medium text-xs"
                    >
                      Edit
                    </button>
                    {post.status === "published" && (
                      <a
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        View
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {toast && <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">{toast}</div>}
    </div>
  );
}
