import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "node:crypto";
import { livekitEnabled, livekitUrl, makeToken } from "@/lib/livekit";
import { createLiveStream } from "@/lib/mux";
import { allSessions, publicView, saveSession } from "@/lib/store";

// Cost protection for public deployments: a few recordings per visitor per hour, and a cap on simultaneous recordings.
const MAX_PER_IP_HOUR = Number(process.env.MAX_SESSIONS_PER_IP_HOUR || 6);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_RECORDINGS || 5);
const hits = new Map<string, number[]>();

function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  hits.set(ip, recent);
  if (recent.length >= MAX_PER_IP_HOUR) return true;
  recent.push(now);
  return false;
}

/** Starts a new session: a Mux live stream (records) and a LiveKit room (carries your camera). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!livekitEnabled) return res.status(503).json({ error: "LiveKit is not configured." });
  const ip = String(req.headers["fly-client-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (tooMany(ip)) return res.status(429).json({ error: "Too many recordings started from your connection. Try again in an hour." });
  if (allSessions().filter((x) => x.status === "created" || x.status === "recording").length >= MAX_CONCURRENT) {
    return res.status(429).json({ error: "The studio is busy right now. Try again in a few minutes." });
  }
  try {
    const id = randomBytes(9).toString("base64url");
    const m = await createLiveStream(id);
    const s = saveSession({
      id,
      status: "created",
      hd: Boolean(req.body?.hd),
      muxLiveId: m.id,
      streamKey: m.stream_key,
      createdAt: Date.now(),
    });
    return res.status(201).json({ session: publicView(s), url: livekitUrl, token: await makeToken(id, `studio-${id}`) });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Could not start a session." });
  }
}
