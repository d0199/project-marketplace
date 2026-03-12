import type { GetServerSideProps } from "next";
import { ptStore } from "@/lib/ptStore";
import { ptUrl } from "@/lib/slugify";

/**
 * Legacy redirect handler for old /pt/{slug} and /pt/{id} URLs.
 * Permanently redirects to the new /pt/{suburb}/{name} URL structure.
 */
export default function PTRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const param = params?.suburb as string;

  // Try direct ID lookup first (handles /pt/pt-001 URLs)
  let pt = await ptStore.getById(param);

  // If not found by ID, try name-only slug lookup
  if (!pt) {
    pt = await ptStore.getBySlug(param);
  }

  // If still not found, try legacy combined slug
  if (!pt) {
    pt = await ptStore.getByLegacySlug(param);
  }

  if (!pt || pt.isActive === false) {
    return { notFound: true };
  }

  // 301 redirect to new nested URL structure
  return { redirect: { destination: ptUrl(pt), permanent: true } };
};
