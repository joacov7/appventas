import { cookies } from "next/headers";

export async function isAdmin(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const store = await cookies();
  const token = store.get("admin-token")?.value;
  return token === adminSecret;
}
