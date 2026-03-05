export interface Address {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}

export interface OpeningHours {
  monday?: string | null;
  tuesday?: string | null;
  wednesday?: string | null;
  thursday?: string | null;
  friday?: string | null;
  saturday?: string | null;
  sunday?: string | null;
}

export interface Gym {
  id: string;
  ownerId: string;
  isActive?: boolean;
  isTest?: boolean;
  isFeatured?: boolean;
  priceVerified?: boolean;
  isPaid?: boolean;
  name: string;
  description: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
  instagram?: string;
  facebook?: string;
  lat: number;
  lng: number;
  amenities: string[];
  hours: OpeningHours;
  hoursComment?: string;
  memberOffers?: string[];
  memberOffersNotes?: string;
  memberOffersScroll?: boolean;
  memberScrollText?: string;
  memberOffersTnC?: string;
  pricePerWeek: number;
  images: string[];
}

export interface Lead {
  id: string;
  gymId: string;
  gymName?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  submittedAt?: string;
  status?: string;
}

export interface OwnerSession {
  ownerId: string;
  email: string;
  name: string;
}

export interface GymEdit {
  id: string;
  gymId: string;
  gymName?: string;
  ownerEmail?: string;
  currentSnapshot?: string; // JSON string of Gym
  proposedChanges?: string; // JSON string of Gym
  status: string; // "pending" | "approved" | "rejected"
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
