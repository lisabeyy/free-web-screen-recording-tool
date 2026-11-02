import { MAX_RECORD_SECONDS } from "./config";

const BASE = "https://api.mux.com/video/v1";
export const RTMP_URL = "rtmps://global-live.mux.com:443/app";

function auth() {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error("Mux keys are missing (MUX_TOKEN_ID / MUX_TOKEN_SECRET).");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

async function mux<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: auth(), ...(init?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.messages?.[0] || `Mux error ${res.status}`);
  return json.data as T;
}

export type MuxLive = {
  id: string;
  stream_key: string;
  status: "idle" | "active" | "disabled";
  recent_asset_ids?: string[];
  playback_ids?: { id: string }[];
  test?: boolean;
};

export type MuxAsset = {
  id: string;
  status: "preparing" | "ready" | "errored";
  duration?: number;
  playback_ids?: { id: string }[];
  static_renditions?: { status?: string; files?: { name: string; status?: string; ext?: string }[] };
};

export const createLiveStream = (passthrough: string) =>
  mux<MuxLive>("/live-streams", {
    method: "POST",
    body: JSON.stringify({
      playback_policy: ["public"],
      passthrough,
      reconnect_window: 10,
      // Backstop for the 1 hour limit (the studio itself stops at exactly 1 hour).
      max_continuous_duration: MAX_RECORD_SECONDS + 60,
      new_asset_settings: { playback_policy: ["public"], static_renditions: [{ resolution: "highest" }] },
    }),
  });

export const getLiveStream = (id: string) => mux<MuxLive>(`/live-streams/${id}`);
export const completeLiveStream = (id: string) => mux<unknown>(`/live-streams/${id}/complete`, { method: "PUT" }).catch(() => undefined);
export const deleteLiveStream = (id: string) => mux<unknown>(`/live-streams/${id}`, { method: "DELETE" }).catch(() => undefined);
export const getAsset = (id: string) => mux<MuxAsset>(`/assets/${id}`);
export const deleteAsset = (id: string) => mux<unknown>(`/assets/${id}`, { method: "DELETE" }).catch(() => undefined);
