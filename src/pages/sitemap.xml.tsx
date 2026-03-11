import type { GetServerSideProps } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { blogStore } from "@/lib/blogStore";
import { POSTCODE_META } from "@/lib/utils";
import { BASE_URL as BASE } from "@/lib/siteUrl";

function entry(loc: string, priority: string, changefreq: string, lastmod?: string) {
  const lm = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `  <url><loc>${loc}</loc>${lm}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

// This component never renders — getServerSideProps writes the XML response directly.
export default function SitemapXml() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const [gyms, pts, blogPosts] = await Promise.all([ownerStore.getAll(), ptStore.getAll(), blogStore.getPublished()]);
  const today = new Date().toISOString().slice(0, 10);

  const activeGyms = gyms.filter((g) => g.isActive !== false && !g.isTest);
  const activePTs = pts.filter((p) => p.isActive !== false && !p.isTest);

  const suburbSlugs = Object.values(POSTCODE_META).map(({ slug }) => slug);

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entry(`${BASE}/`, "1.0", "daily", today),
    entry(`${BASE}/about`, "0.8", "monthly", today),
    entry(`${BASE}/blog`, "0.8", "weekly", today),
    // Blog posts
    ...blogPosts.map((p) =>
      entry(`${BASE}/blog/${p.slug}`, "0.7", "monthly", p.updatedAt?.slice(0, 10) ?? today)
    ),
    // Gym suburb pages
    ...suburbSlugs.map((slug) =>
      entry(`${BASE}/gyms/${slug}`, "0.8", "weekly", today)
    ),
    // Trainer suburb pages
    ...suburbSlugs.map((slug) =>
      entry(`${BASE}/trainers/${slug}`, "0.8", "weekly", today)
    ),
    // Individual gym pages
    ...activeGyms.map((g) =>
      entry(`${BASE}/gym/${g.slug}`, "0.7", "weekly", today)
    ),
    // Individual PT pages
    ...activePTs.map((p) =>
      entry(`${BASE}/pt/${p.slug}`, "0.7", "weekly", today)
    ),
    `</urlset>`,
  ];

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(lines.join("\n"));
  res.end();

  return { props: {} };
};
