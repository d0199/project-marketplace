import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface Props {
  images: string[];
  alt: string;
  sizes?: string;
  showDots?: boolean;
  intervalMs?: number;
  focalPoints?: number[];
}

export default function ImageCarousel({
  images,
  alt,
  sizes = "(max-width: 768px) 100vw, 50vw",
  showDots = true,
  intervalMs = 5000,
  focalPoints,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = images.length;

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % count),
    [count]
  );
  const prev = () => setCurrent((c) => (c - 1 + count) % count);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = setTimeout(next, intervalMs);
    return () => clearTimeout(t);
  }, [current, paused, count, next, intervalMs]);

  return (
    <div
      className="relative w-full h-full group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Images */}
      {images.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={src}
            alt={`${alt} — photo ${i + 1}`}
            fill
            className="object-cover"
            style={{ objectPosition: `center ${focalPoints?.[i] ?? 50}%` }}
            sizes={sizes}
            unoptimized
            priority={i === 0}
          />
        </div>
      ))}

      {count > 1 && (
        <>
          {/* Prev button */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev(); }}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ‹
          </button>

          {/* Next button */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); next(); }}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ›
          </button>

          {/* Dots */}
          {showDots && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrent(i); }}
                  aria-label={`Go to image ${i + 1}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === current ? "bg-white scale-125" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
