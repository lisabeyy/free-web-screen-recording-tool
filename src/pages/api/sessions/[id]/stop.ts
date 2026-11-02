import type { NextApiRequest, NextApiResponse } from "next";
import { KEEP_SECONDS } from "@/lib/config";
import { stopRecording } from "@/lib/livekit";
import { completeLiveStream } from "@/lib/mux";
import { getSession, publicView, saveSession } from "@/lib/store";

/** Ends the recording. The 6 hour download window starts now. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const s = getSession(String(req.query.id || ""));
  if (!s) return res.status(404).json({ error: "Session not found." });
  if (s.status === "recording" || s.status === "created") {
    if (s.egressId) await stopRecording(s.egressId, s.id);
    // Give the last frames a moment to reach Mux, then close the stream so the asset is built now.
    await new Promise((r) => setTimeout(r, 1500));
    await completeLiveStream(s.muxLiveId);
    s.status = "ended";
    s.stoppedAt = Date.now();
    s.expiresAt = s.stoppedAt + KEEP_SECONDS * 1000;
    saveSession(s);
  }
  return res.status(200).json({ session: publicView(s) });
}
