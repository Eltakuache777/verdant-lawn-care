export type WorkerAccount = { username: string; password: string; name: string };

// WORKER_ACCOUNTS format: "username:password:Full Name,username2:password2:Full Name2"
// Pure parsing, no Node-only APIs — safe to import from both middleware (Edge
// runtime) and server components (Node runtime).
export function parseWorkerAccounts(raw: string | undefined): WorkerAccount[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => {
      const [username, password, ...nameParts] = entry.split(":").map((s) => s.trim());
      return { username, password, name: nameParts.join(":") || username };
    })
    .filter((a): a is WorkerAccount => !!a.username && !!a.password);
}
