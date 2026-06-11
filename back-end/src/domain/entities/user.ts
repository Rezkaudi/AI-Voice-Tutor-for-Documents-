
export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}
