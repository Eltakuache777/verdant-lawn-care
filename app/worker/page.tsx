import { headers } from "next/headers";
import AdminShell from "@/app/components/AdminShell";
import { parseWorkerAccounts } from "@/lib/workerAccounts";

function currentUserName(): string | undefined {
  const auth = headers().get("authorization");
  if (!auth?.startsWith("Basic ")) return undefined;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i === -1) return undefined;
  const username = decoded.slice(0, i);

  const account = parseWorkerAccounts(process.env.WORKER_ACCOUNTS).find((a) => a.username === username);
  if (account) return account.name;
  if (username === (process.env.ADMIN_USERNAME || "admin")) return "Admin (preview)";
  return username;
}

export default function WorkerPage() {
  return <AdminShell readOnly loggedInAs={currentUserName()} />;
}
