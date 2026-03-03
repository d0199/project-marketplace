export interface Address {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}

export interface OpeningHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface Gym {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
  lat: number;
  lng: number;
  amenities: string[];
  hours: OpeningHours;
  pricePerWeek: number;
  images: string[];
}

export interface OwnerSession {
  ownerId: string;
  email: string;
  name: string;
}
