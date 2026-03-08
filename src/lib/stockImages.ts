export const STOCK_IMAGES = [
  "/stock/gym-1.jpg",
  "/stock/gym-2.jpg",
  "/stock/gym-3.jpg",
  "/stock/gym-4.jpg",
  "/stock/gym-5.jpg",
  "/stock/gym-6.jpg",
  "/stock/gym-7.jpg",
  "/stock/gym-8.jpg",
  "/stock/gym-9.jpg",
  "/stock/gym-10.jpg",
  "/stock/gym-11.jpg",
  "/stock/gym-12.jpg",
  "/stock/gym-13.jpg",
  "/stock/gym-14.jpg",
  "/stock/gym-15.jpg",
  "/stock/gym-16.jpg",
  "/stock/gym-17.jpg",
  "/stock/gym-18.jpg",
  "/stock/gym-19.jpg",
  "/stock/gym-20.jpg",
];

/**
 * Picks a stock image for a given gym ID, rotating daily.
 * Different gyms get different images; each gym's image changes every 24 hours.
 */
export function getStockImage(gymId: string): string {
  let hash = 0;
  for (let i = 0; i < gymId.length; i++) {
    hash = (hash * 31 + gymId.charCodeAt(i)) >>> 0;
  }
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return STOCK_IMAGES[(hash + dayIndex) % STOCK_IMAGES.length];
}

export const STOCK_ATTRIBUTION = "Generated with AI";
