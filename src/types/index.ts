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
  stripeSubscriptionId?: string;
  stripePlan?: "paid" | "featured";
  googlePlaceId?: string;
  createdBy?: string;
  name: string;
  description: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
  instagram?: string;
  facebook?: string;
  bookingUrl?: string;
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
  pricingNotes?: string;
  amenitiesVerified?: boolean;
  amenitiesNotes?: string;
  pricePerWeek: number; // float — e.g. 24.9
  specialties?: string[];
  images: string[];
  imageFocalPoints?: number[];
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
