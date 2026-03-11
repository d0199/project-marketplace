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
    // Use list with filter — slug GSI method name varies by Amplify codegen
    const { data } = await dataClient.models.BlogPost.list({
      filter: { slug: { eq: slug } },
      limit: 1,
    });
    const first = (data ?? [])[0];
    return first ? toPost(first as unknown as BlogRecord) : null;
  },

  async create(post: Omit<BlogPost, "id" | "createdAt" | "updatedAt">): Promise<BlogPost> {
    const { data } = await dataClient.models.BlogPost.create({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || null,
      content: post.content,
      coverImage: post.coverImage || null,
      coverImageAlt: post.coverImageAlt || null,
      authorName: post.authorName || null,
      authorEmail: post.authorEmail || null,
      tags: post.tags.length > 0 ? post.tags : null,
      status: post.status,
      publishedAt: post.publishedAt || null,
      seoTitle: post.seoTitle || null,
      seoDescription: post.seoDescription || null,
    });
    return toPost(data as unknown as BlogRecord);
  },

  async update(post: BlogPost): Promise<BlogPost> {
    const { data } = await dataClient.models.BlogPost.update({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || null,
      content: post.content,
      coverImage: post.coverImage || null,
      coverImageAlt: post.coverImageAlt || null,
      authorName: post.authorName || null,
      authorEmail: post.authorEmail || null,
      tags: post.tags.length > 0 ? post.tags : null,
      status: post.status,
      publishedAt: post.publishedAt || null,
      seoTitle: post.seoTitle || null,
      seoDescription: post.seoDescription || null,
    });
    return toPost(data as unknown as BlogRecord);
  },

  async delete(id: string): Promise<void> {
    await dataClient.models.BlogPost.delete({ id });
  },
};
