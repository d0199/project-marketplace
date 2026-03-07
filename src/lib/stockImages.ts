/**
 * Stock images used as fallbacks for gyms with no uploaded images.
 * Attribution: Fitness Stock photos by Vecteezy (https://www.vecteezy.com/free-photos/fitness)
 *
 * DEV: currently using picsum.photos placeholders.
 * PROD: replace each entry with the real downloaded Vecteezy image path e.g. "/stock/gym-1.jpg"
 */

export const STOCK_IMAGES = [
  "/stock/gym-1.jpg",
  "/stock/gym-2.jpg",
  "/stock/gym-3.jpg",
  "/stock/gym-4.jpg",
  "/stock/gym-5.jpg",
  "/stock/gym-6.jpg",
  "/stock/gym-7.jpg",
  "/stock/gym-8.jpg",
];

/**
 * Deterministically picks a stock image for a given gym ID.
 * Same gym always gets the same image across renders and sessions.
 */
export function getStockImage(gymId: string): string {
  let hash = 0;
  for (let i = 0; i < gymId.length; i++) {
    hash = (hash * 31 + gymId.charCodeAt(i)) >>> 0;
  }
  return STOCK_IMAGES[hash % STOCK_IMAGES.length];
}

export const STOCK_ATTRIBUTION = {
  text: "Fitness Stock photos by Vecteezy",
  href: "https://www.vecteezy.com/free-photos/fitness",
};
