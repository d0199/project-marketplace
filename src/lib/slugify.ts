/**
 * Slugify a single string.
 * e.g. "Anytime Fitness" → "anytime-fitness"
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a URL-friendly slug from a name and suburb (LEGACY — combined).
 * e.g. "Anytime Fitness" + "Perth CBD" → "anytime-fitness-perth-cbd"
 * Used only for backward-compat redirects from old URLs.
 */
export function generateSlug(name: string, suburb: string): string {
  return slugify(`${name}-${suburb}`);
}

/**
 * Generate a name-only slug.
 * e.g. "Anytime Fitness" → "anytime-fitness"
 */
export function generateNameSlug(name: string): string {
  return slugify(name);
}

/**
 * Generate a suburb slug from suburb name and postcode.
 * e.g. "Perth CBD" + "6000" → "perth-cbd-6000"
 */
export function generateSuburbSlug(suburb: string, postcode: string): string {
  return slugify(`${suburb}-${postcode}`);
}

/**
 * Build the canonical URL path for a gym or PT.
 * e.g. gymUrl({ suburbSlug: "perth-cbd-6000", slug: "anytime-fitness" }) → "/gym/perth-cbd-6000/anytime-fitness"
 */
export function gymUrl(g: { suburbSlug: string; slug: string }): string {
  return `/gym/${g.suburbSlug}/${g.slug}`;
}

export function ptUrl(p: { suburbSlug: string; slug: string }): string {
  return `/pt/${p.suburbSlug}/${p.slug}`;
}

/**
 * Deduplicate slugs in a list of items by appending -2, -3, etc.
 * Items are processed in array order — first occurrence keeps the base slug.
 */
export function deduplicateSlugs<T extends { slug: string }>(items: T[]): T[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = item.slug;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    if (count === 1) return item;
    return { ...item, slug: `${base}-${count}` };
  });
}
