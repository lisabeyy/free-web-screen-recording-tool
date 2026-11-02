import { ABANDONED_SECONDS, KEEP_SECONDS } from "./config";
import { egressIsActive } from "./livekit";
import { deleteAsset, deleteLiveStream, getAsset, getLiveStream } from "./mux";
import { allSessions, getSession, removeSession, saveSession, type Session } from "./store";

/** Brings a session up to date with Mux / LiveKit. Safe to call as often as you like. */
export async function reconcile(s: Session): Promise<Session> {
  const now = Date.now();
  try {
    if (s.status === "created" && now - s.createdAt > ABANDONED_SECONDS * 1000) {
      await destroy(s);
      return { ...s, status: "failed", error: "Session expired." };
    }

    if (s.status === "recording") {
      if (!s.live && s.egressId) {
        const e = await egressIsActive(s.egressId);
        if (e.failed) {
          s.status = "failed";
          s.error = e.error || "The recorder could not start.";
          s.expiresAt = now + KEEP_SECONDS * 1000;
          return saveSession(s);
        }
        if (e.active) {
          s.live = true;
          s.startedAt = now;
          saveSession(s);
        }
      }
      // The tab was closed or the 1 hour limit hit: Mux finished the stream by itself.
      const live = await getLiveStream(s.muxLiveId);
      if (live.status === "idle" && live.recent_asset_ids?.length) {
        s.status = "ended";
        s.stoppedAt = now;
        s.expiresAt = now + KEEP_SECONDS * 1000;
        saveSession(s);
      }
    }

    if (s.status === "ended") {
      const live = await getLiveStream(s.muxLiveId);
      const assetId = live.recent_asset_ids?.[live.recent_asset_ids.length - 1];
      if (assetId) {
        const a = await getAsset(assetId);
        s.assetId = assetId;
        s.playbackId = a.playback_ids?.[0]?.id;
        s.duration = a.duration;
        const mp4 = a.static_renditions?.files?.find((f) => f.status === "ready" && /\.mp4$/i.test(f.name));
        if (a.status === "errored") {
          s.status = "failed";
          s.error = "Mux could not process this recording.";
        } else if (a.status === "ready" && mp4) {
          s.file = mp4.name;
          s.status = "ready";
        }
        saveSession(s);
      } else if (now - (s.stoppedAt || now) > 3 * 60 * 1000) {
        s.status = "failed";
        s.error = "Nothing was recorded.";
        saveSession(s);
      }
    }
  } catch (e) {
    console.error("reconcile", s.id, e);
  }
  return s;
}

/** Deletes the recording from Mux and forgets the session. */
export async function destroy(s: Session) {
  if (s.assetId) await deleteAsset(s.assetId);
  await deleteLiveStream(s.muxLiveId);
  removeSession(s.id);
}

/** Deletes everything past its 6 hour window so nothing is stored longer than promised. */
export async function sweep() {
  const now = Date.now();
  for (const s of allSessions()) {
    if (s.expiresAt && s.expiresAt <= now) {
      // Make sure we know the asset id before deleting, so Mux storage is really freed.
      if (!s.assetId) {
        const live = await getLiveStream(s.muxLiveId).catch(() => null);
        s.assetId = live?.recent_asset_ids?.[live.recent_asset_ids.length - 1];
      }
      await destroy(s);
    } else if (s.status === "recording" || s.status === "ended" || s.status === "created") {
      await reconcile(s);
    }
  }
}

export const findSession = getSession;
