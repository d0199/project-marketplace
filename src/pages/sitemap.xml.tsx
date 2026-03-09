import type { GetServerSideProps } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { POSTCODE_META } from "@/lib/utils";

const BASE = "https://www.mynextgym.com.au";

function entry(loc: string, priority: string, changefreq: string, lastmod?: string) {
  const lm = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `  <url><loc>${loc}</loc>${lm}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

// This component never renders — getServerSideProps writes the XML response directly.
export default function SitemapXml() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const gyms = await ownerStore.getAll();
  const today = new Date().toISOString().slice(0, 10);

  const activeGyms = gyms.filter((g) => g.isActive !== false && !g.isTest);

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    entry(`${BASE}/`, "1.0", "daily", today),
    ...Object.values(POSTCODE_META).map(({ slug }) =>
      entry(`${BASE}/gyms/${slug}`, "0.8", "weekly", today)
    ),
    ...activeGyms.map((g) =>
      entry(`${BASE}/gym/${g.id}`, "0.7", "weekly", today)
    ),
    `</urlset>`,
  ];

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(lines.join("\n"));
  res.end();

  return { props: {} };
};
