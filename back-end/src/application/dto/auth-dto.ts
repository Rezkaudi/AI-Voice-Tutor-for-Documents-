import type { User } from "@/domain/entities/user";
import type { AuthTokens } from "@/domain/services/token-service";

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}


export interface AuthResultDto {
  user: AuthenticatedUserDto;
  tokens: AuthTokens;
}

export function toAuthenticatedUserDto(user: User): AuthenticatedUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture
  };
}
