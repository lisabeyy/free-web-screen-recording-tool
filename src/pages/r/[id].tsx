import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Hls from "hls.js";
import { clock, forgetId, timeLeft, type View } from "@/lib/client";

export default function Recording() {
  const router = useRouter();
  const id = String(router.query.id || "");
  const [view, setView] = useState<View | null>(null);
  const [gone, setGone] = useState("");
  const [now, setNow] = useState(Date.now());
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/sessions/${id}`);
      const d = await r.json();
      if (stop) return;
      if (!r.ok) {
        forgetId(id);
        return setGone(d.error || "Not found.");
      }
      setView(d.session);
      if (d.session.status !== "ready" && d.session.status !== "failed") setTimeout(tick, 3000);
    };
    void tick();
    const clockTimer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      stop = true;
      clearInterval(clockTimer);
    };
  }, [id]);

  useEffect(() => {
    const el = video.current;
    if (!el || !view?.playbackId) return;
    const src = `https://stream.mux.com/${view.playbackId}.m3u8`;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      return;
    }
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(el);
      return () => hls.destroy();
    }
  }, [view?.playbackId]);

  const remove = async () => {
    if (!confirm("Delete this recording now? This cannot be undone.")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    forgetId(id);
    void router.push("/recordings");
  };

  const name = `recording-${new Date(view?.stoppedAt || Date.now()).toISOString().slice(0, 16).replace(/[T:]/g, "-")}`;

  return (
    <main className="page">
      <header className="top">
        <a className="brand" href="/">Free Web Screen Recording Tool</a>
        <a href="/recordings">My recordings</a>
      </header>
      <div className="narrow">
        {gone ? (
          <>
            <h1>Recording not available</h1>
            <p className="muted">{gone}</p>
            <a className="btn primary" href="/">Record a new one</a>
          </>
        ) : !view ? (
          <p className="muted">Loading</p>
        ) : view.status === "failed" ? (
          <>
            <h1>Something went wrong</h1>
            <p className="muted">{view.error || "The recording could not be saved."}</p>
            <a className="btn primary" href="/">Try again</a>
          </>
        ) : view.status !== "ready" ? (
          <>
            <h1>Preparing your recording</h1>
            <p className="muted">This usually takes under a minute. You can keep this tab open.</p>
            <div className="spinner" />
          </>
        ) : (
          <>
            <h1>Your recording is ready</h1>
            <video ref={video} controls playsInline className="player" />
            <div className="bar">
              {view.downloadUrl && (
                <a className="btn primary big" href={`${view.downloadUrl}?download=${name}`}>Download MP4</a>
              )}
              <button className="btn" onClick={remove}>Delete now</button>
              <a className="btn" href="/">Record another</a>
            </div>
            <p className="muted">
              {view.duration ? `Length ${clock(view.duration)}. ` : ""}
              {view.expiresAt ? `Deleted automatically in ${timeLeft(view.expiresAt - now)}. Download it before then.` : ""}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
