import { handleLogout } from "@/features/images/api";

export async function POST() {
  return handleLogout();
}
