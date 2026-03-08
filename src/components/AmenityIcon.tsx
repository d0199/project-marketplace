import React from "react";

interface Props {
  amenity: string;
  className?: string;
}

const ICONS: Record<string, () => React.ReactElement> = {
  pool: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="6" r="1.5" />
      <path d="M3 16c1.5-2.5 3-2.5 4.5 0s3 2.5 4.5 0 3-2.5 4.5 0 3-2.5 4.5 0" />
      <path d="M5 12l3.5-5.5 3 3.5 2-3" />
    </svg>
  ),
  spa: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3C9 7.5 6 10 6 14a6 6 0 0012 0c0-4-3-6.5-6-11z" />
      <path d="M12 20v2M9 22h6" />
    </svg>
  ),
  sauna: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3c0 2.5-2 3.5-2 6M12 3c0 2.5-2 3.5-2 6M16 3c0 2.5-2 3.5-2 6" />
      <rect x="3" y="13" width="18" height="8" rx="2" />
      <path d="M7 18h10" />
    </svg>
  ),
  "free weights": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 12h12" />
      <path d="M3 9v6M6 9v6M18 9v6M21 9v6" />
    </svg>
  ),
  cardio: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h3.5l2-6 4 12 2.5-6H22" />
    </svg>
  ),
  "group classes": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="2" />
      <circle cx="16" cy="6" r="2" />
      <path d="M5 20v-4a3 3 0 016 0v4" />
      <path d="M13 20v-4a3 3 0 016 0v4" />
    </svg>
  ),
  "boxing/mma": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="9" width="10" height="9" rx="4" />
      <path d="M10 9V7a2 2 0 014 0v2" />
      <path d="M7 15h10" />
      <path d="M17 12h2a1.5 1.5 0 000-3h-2" />
    </svg>
  ),
  "yoga/pilates": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="1.75" />
      <path d="M12 6.5v5" />
      <path d="M8 10l4 2 4-2" />
      <path d="M9 19l3-5.5 3 5.5" />
    </svg>
  ),
  parking: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 8h4.5a2.5 2.5 0 010 5H9V8z" />
      <path d="M9 13v4" />
    </svg>
  ),
  showers: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7.5A5.5 5.5 0 0117 7.5" />
      <path d="M12 8v3" />
      <path d="M8.5 14l-.5 2M12 13.5V16M15.5 14l.5 2" />
    </svg>
  ),
  lockers: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
      <circle cx="12" cy="16" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  ),
  childcare: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8.5" cy="5.5" r="2" />
      <circle cx="16" cy="7" r="1.5" />
      <path d="M5.5 20v-5a3 3 0 016 0v5" />
      <path d="M13 20v-3.5a3 3 0 016 0V20" />
    </svg>
  ),
  "café": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6c0 1.5-1 2-1 3.5M12 5c0 1.5-1 2-1 3.5" />
      <path d="M6 11h12l-1.5 8H7.5L6 11z" />
      <path d="M18 13h2a2 2 0 000-4h-2" />
    </svg>
  ),
  "24/7 access": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  "personal training": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7.5v6" />
      <path d="M8 10.5l4 2 4-2" />
      <path d="M9 20l3-4.5 3 4.5" />
      <path d="M5 9.5h2.5M19 9.5h-2.5M5 9.5v3M19 9.5v3" />
    </svg>
  ),
};

const MEMBER_OFFER_SVG_ICONS: Record<string, () => React.ReactElement> = {
  "no contract": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  ),
  "contract": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
      <path d="M15 17l1.5 2 2.5-3" />
    </svg>
  ),
  "new member trial": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v8H4v-8" />
      <path d="M22 7H2v5h20V7z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  ),
  "referral scheme": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M9 9l6 6" />
      <path d="M17 7h-4M7 17v-4" />
    </svg>
  ),
  "multiple location access": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11a3 3 0 106 0 3 3 0 00-6 0z" />
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
    </svg>
  ),
  "gym or community app": () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  ),
};

export function MemberOfferIcon({ offer, className = "w-4 h-4" }: { offer: string; className?: string }) {
  const Icon = MEMBER_OFFER_SVG_ICONS[offer];
  if (!Icon) return null;
  return <span className={`inline-flex shrink-0 ${className}`}><Icon /></span>;
}

export default function AmenityIcon({ amenity, className = "w-4 h-4" }: Props) {
  const Icon = ICONS[amenity];
  if (!Icon) return null;
  return <span className={`inline-flex shrink-0 ${className}`}><Icon /></span>;
}
