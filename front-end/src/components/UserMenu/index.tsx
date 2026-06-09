import type { AuthUser } from "@/services/authApi";
import { UserAvatar } from "./UserAvatar";

export function UserMenu({ user }: { user: AuthUser }) {
  return <UserAvatar name={user.name} picture={user.picture} size={36} />;
}
