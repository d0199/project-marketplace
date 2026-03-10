import type { GetServerSideProps } from "next";
import { BASE_URL } from "@/lib/siteUrl";

const isProduction = BASE_URL === "https://www.mynextgym.com.au";

export default function RobotsTxt() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const body = isProduction
    ? `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`
    : `User-agent: *\nDisallow: /\n`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.write(body);
  res.end();

  return { props: {} };
};
