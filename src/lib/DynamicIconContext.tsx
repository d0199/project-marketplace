import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface DynamicIconState {
  amenities: Record<string, string>;
  memberOffers: Record<string, string>;
}

const DynamicIconContext = createContext<DynamicIconState>({ amenities: {}, memberOffers: {} });

export function useDynamicIcons() {
  return useContext(DynamicIconContext);
}

export function DynamicIconProvider({ children }: { children: ReactNode }) {
  const [icons, setIcons] = useState<DynamicIconState>({ amenities: {}, memberOffers: {} });

  useEffect(() => {
    Promise.all([
      fetch("/api/datasets/amenities").then((r) => r.ok ? r.json() : null),
      fetch("/api/datasets/member-offers").then((r) => r.ok ? r.json() : null),
    ]).then(([amenityData, memberOfferData]) => {
      setIcons({
        amenities: amenityData?.icons ?? {},
        memberOffers: memberOfferData?.icons ?? {},
      });
    }).catch(() => {});
  }, []);

  return (
    <DynamicIconContext.Provider value={icons}>
      {children}
    </DynamicIconContext.Provider>
  );
}
