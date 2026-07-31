import { cookies } from "next/headers";
import AdminShell from "@/app/components/AdminShell";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export default async function WorkerPage() {
  const session = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  const loggedInAs = session?.role === "admin" ? "Admin (preview)" : session?.name || session?.email;
  return <AdminShell readOnly loggedInAs={loggedInAs} />;
}
