import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverImageAlt: string;
  authorName: string;
  authorEmail: string;
  tags: string[];
  status: "draft" | "published" | "archived";
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  createdAt?: string;
  updatedAt?: string;
}

type BlogRecord = Record<string, unknown>;

function toPost(r: BlogRecord): BlogPost {
  return {
    id: String(r.id ?? ""),
    slug: String(r.slug ?? ""),
    title: String(r.title ?? ""),
    excerpt: String(r.excerpt ?? ""),
    content: String(r.content ?? ""),
    coverImage: String(r.coverImage ?? ""),
    coverImageAlt: String(r.coverImageAlt ?? ""),
    authorName: String(r.authorName ?? ""),
    authorEmail: String(r.authorEmail ?? ""),
    tags: ((r.tags as string[] | null) ?? []).filter(Boolean),
    status: (r.status === "published" ? "published" : r.status === "archived" ? "archived" : "draft") as BlogPost["status"],
    publishedAt: String(r.publishedAt ?? ""),
    seoTitle: String(r.seoTitle ?? ""),
    seoDescription: String(r.seoDescription ?? ""),
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

/** Strip newlines from strings for safe DynamoDB/AppSync storage — newlines in GraphQL string fields break response parsing */
function sanitize(val: string): string {
  return val.replace(/[\n\r]/g, "");
}

export const blogStore = {
  async getAll(): Promise<BlogPost[]> {
    if (!isAmplifyConfigured()) return [];
    const results: BlogRecord[] = [];
    let nextToken: string | null | undefined;
    do {
      const res = await dataClient.models.BlogPost.list({ limit: 1000, nextToken });
      results.push(...(res.data ?? []));
      nextToken = res.nextToken;
    } while (nextToken);
    return results.map(toPost);
  },

  async getPublished(): Promise<BlogPost[]> {
    const all = await this.getAll();
    return all
      .filter((p) => p.status === "published")
      .sort((a, b) => (b.publishedAt || b.createdAt || "").localeCompare(a.publishedAt || a.createdAt || ""));
  },

  async getById(id: string): Promise<BlogPost | null> {
    if (!isAmplifyConfigured()) return null;
    const { data } = await dataClient.models.BlogPost.get({ id });
    return data ? toPost(data as unknown as BlogRecord) : null;
  },

  async getBySlug(slug: string): Promise<BlogPost | null> {
    if (!isAmplifyConfigured()) return null;
    // Scan all posts and match slug client-side — DynamoDB filter with limit:1
    // can miss results because limit applies before filter
    const all = await this.getAll();
    return all.find((p) => p.slug === slug) ?? null;
  },

  async create(post: Omit<BlogPost, "id" | "createdAt" | "updatedAt">): Promise<BlogPost> {
    const { data } = await dataClient.models.BlogPost.create({
      slug: post.slug,
      title: sanitize(post.title),
      excerpt: post.excerpt ? sanitize(post.excerpt) : null,
      content: sanitize(post.content),
      coverImage: post.coverImage || null,
      coverImageAlt: post.coverImageAlt ? sanitize(post.coverImageAlt) : null,
      authorName: post.authorName || null,
      authorEmail: post.authorEmail || null,
      tags: post.tags.length > 0 ? post.tags : null,
      status: post.status,
      publishedAt: post.publishedAt || null,
      seoTitle: post.seoTitle ? sanitize(post.seoTitle) : null,
      seoDescription: post.seoDescription ? sanitize(post.seoDescription) : null,
    });
    return toPost(data as unknown as BlogRecord);
  },

  async update(post: BlogPost): Promise<BlogPost> {
    const { data } = await dataClient.models.BlogPost.update({
      id: post.id,
      slug: post.slug,
      title: sanitize(post.title),
      excerpt: post.excerpt ? sanitize(post.excerpt) : null,
      content: sanitize(post.content),
      coverImage: post.coverImage || null,
      coverImageAlt: post.coverImageAlt ? sanitize(post.coverImageAlt) : null,
      authorName: post.authorName || null,
      authorEmail: post.authorEmail || null,
      tags: post.tags.length > 0 ? post.tags : null,
      status: post.status,
      publishedAt: post.publishedAt || null,
      seoTitle: post.seoTitle ? sanitize(post.seoTitle) : null,
      seoDescription: post.seoDescription ? sanitize(post.seoDescription) : null,
    });
    return toPost(data as unknown as BlogRecord);
  },

  async delete(id: string): Promise<void> {
    await dataClient.models.BlogPost.delete({ id });
  },
};
