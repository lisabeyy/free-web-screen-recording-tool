import type { NextApiRequest, NextApiResponse } from "next";
import { startRecording } from "@/lib/livekit";
import { getSession, publicView, saveSession } from "@/lib/store";

/** Called once the browser has published its tracks: starts the recorder. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const s = getSession(String(req.query.id || ""));
  if (!s || s.status !== "created") return res.status(404).json({ error: "Session not found." });
  const { videoTrackId, audioTrackId } = req.body || {};
  if (typeof videoTrackId !== "string" || typeof audioTrackId !== "string") return res.status(400).json({ error: "Missing tracks." });
  try {
    s.egressId = await startRecording(s.id, s.streamKey, videoTrackId, audioTrackId, s.hd);
    s.status = "recording";
    return res.status(200).json({ session: publicView(saveSession(s)) });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Could not start the recorder." });
  }
}
