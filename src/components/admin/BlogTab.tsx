import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/adminFetch";
import type { BlogPost } from "@/lib/blogStore";

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

export default function BlogTab({ adminEmail }: Props) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<{ post: BlogPost; isNew: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

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

  function update(fields: Partial<BlogPost>) {
    if (!panel) return;
    setPanel({ ...panel, post: { ...panel.post, ...fields } });
  }

  // Simple markdown to HTML for preview (handles headings, bold, italic, lists, links, paragraphs)
  function renderMarkdown(md: string): string {
    return md
      .replace(/^### (.+)$/gm, "<h3 class='text-lg font-semibold text-gray-900 mt-4 mb-2'>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2 class='text-xl font-semibold text-gray-900 mt-6 mb-3'>$1</h2>")
      .replace(/^# (.+)$/gm, "<h2 class='text-2xl font-bold text-gray-900 mt-8 mb-4'>$1</h2>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^\- (.+)$/gm, "<li class='ml-4 list-disc text-gray-700'>$1</li>")
      .replace(/^\d+\. (.+)$/gm, "<li class='ml-4 list-decimal text-gray-700'>$1</li>")
      .replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' class='text-brand-orange hover:underline' target='_blank' rel='noopener noreferrer'>$1</a>")
      .replace(/\n\n/g, "</p><p class='text-gray-700 leading-relaxed mb-3'>")
      .replace(/^(?!<[hla-z])/gm, "")
      .replace(/^/, "<p class='text-gray-700 leading-relaxed mb-3'>")
      .concat("</p>");
  }

  if (panel) {
    const { post, isNew } = panel;
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? "New Blog Post" : `Edit: ${post.title || "Untitled"}`}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview(!preview)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg"
            >
              {preview ? "Edit" : "Preview"}
            </button>
            <button onClick={() => { setPanel(null); setPreview(false); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg">
              Cancel
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg">
              {isNew ? "Create" : "Save"}
            </button>
          </div>
        </div>

        {preview ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-3xl mx-auto">
            <p className="text-sm text-gray-400 mb-2">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" }) : "Draft"}</p>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{post.title || "Untitled"}</h1>
            {post.excerpt && <p className="text-lg text-gray-500 mb-6">{post.excerpt}</p>}
            {post.authorName && <p className="text-sm text-gray-400 mb-6">By {post.authorName}</p>}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {post.tags.map((t) => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>
            )}
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Main content — 2 cols */}
            <div className="col-span-2 space-y-4">
              <div>
                <label className={labelCls}>Title</label>
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
                <label className={labelCls}>Excerpt <span className="text-gray-400 font-normal">(also used as meta description)</span></label>
                <textarea className={inputCls + " resize-none"} rows={2} value={post.excerpt} onChange={(e) => update({ excerpt: e.target.value })} placeholder="Brief summary (120-155 chars ideal)" />
                <p className="text-xs text-gray-400 mt-1">{post.excerpt.length}/155 characters</p>
              </div>
              <div>
                <label className={labelCls}>Content <span className="text-gray-400 font-normal">(Markdown supported)</span></label>
                <textarea
                  className={inputCls + " resize-y font-mono text-sm"}
                  rows={20}
                  value={post.content}
                  onChange={(e) => update({ content: e.target.value })}
                  placeholder={"## Section heading\n\nWrite your content here. **Bold** and *italic* text, [links](url), and lists are supported.\n\n- Bullet point\n- Another point\n\n1. Numbered item\n2. Another item"}
                />
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
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">SEO Overrides</h3>
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
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Tags</h3>
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
              <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
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
        </select>
        <span className="text-sm text-gray-400">{filtered.length} post{filtered.length !== 1 ? "s" : ""}</span>
        <div className="flex-1" />
        <button
          onClick={() => setPanel({ post: newPost(), isNew: true })}
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
                    post.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
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
                      onClick={() => setPanel({ post: { ...post }, isNew: false })}
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
