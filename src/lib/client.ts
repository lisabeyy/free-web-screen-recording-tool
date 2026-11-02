const KEY = "studio:recordings";

export function savedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function rememberId(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...savedIds().filter((x) => x !== id)].slice(0, 50)));
  } catch {}
}

export function forgetId(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(savedIds().filter((x) => x !== id)));
  } catch {}
}

export type View = {
  id: string;
  status: "created" | "recording" | "ended" | "ready" | "failed";
  live: boolean;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  expiresAt?: number;
  duration?: number;
  playbackId?: string;
  downloadUrl?: string;
  error?: string;
};

export const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const timeLeft = (ms: number) => {
  const min = Math.max(0, Math.floor(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
};
