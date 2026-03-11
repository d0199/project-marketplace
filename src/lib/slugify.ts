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
