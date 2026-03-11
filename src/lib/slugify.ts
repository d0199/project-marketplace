/**
 * Generate a URL-friendly slug from a name and suburb.
 * e.g. "Anytime Fitness" + "Perth CBD" → "anytime-fitness-perth-cbd"
 */
export function generateSlug(name: string, suburb: string): string {
  return [name, suburb]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
