import type { NextApiRequest, NextApiResponse } from "next";
import { destroy, reconcile } from "@/lib/sessions";
import { getSession, publicView } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const s = getSession(String(req.query.id || ""));
  if (!s) return res.status(404).json({ error: "This recording does not exist or was already deleted." });

  if (req.method === "DELETE") {
    await destroy(s);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (s.expiresAt && s.expiresAt <= Date.now()) {
    await destroy(s);
    return res.status(404).json({ error: "This recording was deleted after 6 hours." });
  }
  return res.status(200).json({ session: publicView(await reconcile(s)) });
}
