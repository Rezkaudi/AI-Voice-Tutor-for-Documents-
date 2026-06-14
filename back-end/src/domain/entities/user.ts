
export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
  subscriptionCredits: number;
  topupCredits: number;
  stripeCustomerId: string | null;
  hasPurchased: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}
