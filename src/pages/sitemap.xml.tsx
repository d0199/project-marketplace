import type { GetServerSideProps } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { blogStore } from "@/lib/blogStore";
import { BASE_URL as BASE } from "@/lib/siteUrl";
import { gymUrl, ptUrl } from "@/lib/slugify";

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

  // Derive suburb slugs from actual gym/PT data so every suburb with a listing is covered
  const gymSuburbs = new Set(activeGyms.map((g) => g.suburbSlug));
  const ptSuburbs = new Set(activePTs.map((p) => p.suburbSlug));
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entry(`${BASE}/`, "1.0", "daily", today),
    entry(`${BASE}/about`, "0.8", "monthly", today),
    entry(`${BASE}/resources`, "0.8", "weekly", today),
    // Resources
    ...blogPosts.map((p) =>
      entry(`${BASE}/resources/${p.slug}`, "0.7", "monthly", p.updatedAt?.slice(0, 10) ?? today)
    ),
    // Gym suburb pages (only suburbs that have at least one active gym)
    ...[...gymSuburbs].map((slug) =>
      entry(`${BASE}/gyms/${slug}`, "0.8", "weekly", today)
    ),
    // Trainer suburb pages (only suburbs that have at least one active PT)
    ...[...ptSuburbs].map((slug) =>
      entry(`${BASE}/trainers/${slug}`, "0.8", "weekly", today)
    ),
    // Individual gym pages
    ...activeGyms.map((g) =>
      entry(`${BASE}${gymUrl(g)}`, "0.7", "weekly", today)
    ),
    // Individual PT pages
    ...activePTs.map((p) =>
      entry(`${BASE}${ptUrl(p)}`, "0.7", "weekly", today)
    ),
    `</urlset>`,
  ];

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(lines.join("\n"));
  res.end();

  return { props: {} };
};
