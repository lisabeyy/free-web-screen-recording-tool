import fs from "node:fs";
import path from "node:path";

export type Session = {
  id: string;
  status: "created" | "recording" | "ended" | "ready" | "failed";
  hd: boolean;
  muxLiveId: string;
  streamKey: string;
  egressId?: string;
  live?: boolean; // egress is connected and Mux is receiving video
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  expiresAt?: number;
  assetId?: string;
  playbackId?: string;
  file?: string; // mp4 rendition name once downloadable
  duration?: number;
  error?: string;
};

const FILE = path.join(process.cwd(), "data", "sessions.json");
let cache: Record<string, Session> | null = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}

function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(cache));
  fs.renameSync(FILE + ".tmp", FILE);
}

export const getSession = (id: string) => load()[id] || null;
export const allSessions = () => Object.values(load());
export function saveSession(s: Session) {
  load()[s.id] = s;
  persist();
  return s;
}
export function removeSession(id: string) {
  delete load()[id];
  persist();
}

/** What the browser is allowed to see (never the stream key). */
export function publicView(s: Session) {
  const downloadable = s.status === "ready" && s.playbackId && s.file;
  return {
    id: s.id,
    status: s.status,
    live: Boolean(s.live),
    createdAt: s.createdAt,
    startedAt: s.startedAt,
    stoppedAt: s.stoppedAt,
    expiresAt: s.expiresAt,
    duration: s.duration,
    playbackId: s.status === "ready" ? s.playbackId : undefined,
    downloadUrl: downloadable ? `https://stream.mux.com/${s.playbackId}/${s.file}` : undefined,
    error: s.error,
  };
}
