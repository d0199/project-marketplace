import type { GetServerSideProps } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { gymUrl } from "@/lib/slugify";

/**
 * Legacy redirect handler for old /gym/{slug} and /gym/{id} URLs.
 * Permanently redirects to the new /gym/{suburb}/{name} URL structure.
 */
export default function GymRedirect() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const param = params?.suburb as string;

  // Try direct ID lookup first (handles /gym/gym-044 URLs)
  let gym = await ownerStore.getById(param);

  // If not found by ID, try name-only slug lookup
  if (!gym) {
    gym = await ownerStore.getBySlug(param);
  }

  // If still not found, try legacy combined slug (e.g. "anytime-fitness-perth-cbd")
  if (!gym) {
    gym = await ownerStore.getByLegacySlug(param);
  }

  if (!gym || gym.isActive === false) {
    return { redirect: { destination: "/", permanent: false } };
  }

  // 301 redirect to new nested URL structure
  return { redirect: { destination: gymUrl(gym), permanent: true } };
};
