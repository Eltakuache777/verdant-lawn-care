import { cookies } from "next/headers";
import AdminShell from "@/app/components/AdminShell";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export default async function AdminPage() {
  const session = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  return <AdminShell loggedInAs={session?.name || session?.email} />;
}
