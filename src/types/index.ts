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

export interface PersonalTrainer {
  id: string;
  ownerId: string;
  isActive?: boolean;
  isTest?: boolean;
  isFeatured?: boolean;
  isPaid?: boolean;
  stripeSubscriptionId?: string;
  stripePlan?: "paid" | "featured";
  createdBy?: string;
  name: string;
  description: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  bookingUrl?: string;
  lat: number;
  lng: number;
  images: string[];
  imageFocalPoints?: number[];
  // PT-specific fields
  gymIds: string[];
  specialties: string[];
  qualifications: string[];
  qualificationsVerified?: boolean;
  qualificationsNotes?: string;
  qualificationEvidence?: string; // URL or text description of evidence submitted
  memberOffers?: string[];
  memberOffersNotes?: string;
  memberOffersTnC?: string;
  experienceYears?: number;
  pricePerSession?: number;
  sessionDuration?: number; // minutes
  pricingNotes?: string;
  availability?: string;
  gender?: string;
  languages?: string[];
  customLeadFields?: CustomLeadField[];
}

export interface CustomLeadField {
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[]; // for select type
  required?: boolean;
}

export interface Lead {
  id: string;
  gymId: string;
  gymName?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  customData?: string; // JSON string of custom field responses
  entityType?: "gym" | "pt";
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
  currentSnapshot?: string; // JSON string of Gym or PersonalTrainer
  proposedChanges?: string; // JSON string of Gym or PersonalTrainer
  status: string; // "pending" | "approved" | "rejected"
  notes?: string;
  editType?: string; // "gym" (default) | "pt"
  createdAt?: string;
  updatedAt?: string;
}
