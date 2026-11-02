import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { LocalAudioTrack, LocalVideoTrack, Room, Track } from "livekit-client";
import { AudioMixer } from "@/lib/studio/audio";
import { BACKGROUNDS, Compositor, DEFAULT_LOOK, LAYOUTS, type Look } from "@/lib/studio/compositor";
import { clock, rememberId, type View } from "@/lib/client";
import { MAX_RECORD_SECONDS } from "@/lib/config";

type Phase = "setup" | "countdown" | "starting" | "recording" | "stopping";

export default function Studio() {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const comp = useRef<Compositor | null>(null);
  const mixer = useRef<AudioMixer | null>(null);
  const camStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const room = useRef<Room | null>(null);
  const sessionId = useRef("");

  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [hd, setHd] = useState(true);
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState("");
  const [micId, setMicId] = useState("");

  const recording = phase === "starting" || phase === "recording";

  // One compositor + mixer for the life of the page.
  useEffect(() => {
    const c = new Compositor();
    const m = new AudioMixer();
    comp.current = c;
    mixer.current = m;
    stage.current?.appendChild(c.canvas);
    c.start();
    const meter = setInterval(() => setLevel(m.level()), 80);
    return () => {
      clearInterval(meter);
      c.stop();
      m.close();
      c.canvas.remove();
      camStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (comp.current) comp.current.look = look;
  }, [look]);

  useEffect(() => {
    if (phase === "setup") comp.current?.setSize(hd);
  }, [hd, phase]);

  const openDevices = useCallback(async (video?: string, audio?: string) => {
    try {
      camStream.current?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: video ? { exact: video } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { deviceId: audio ? { exact: audio } : undefined, echoCancellation: true, noiseSuppression: true },
      });
      camStream.current = s;
      comp.current?.setCamera(s);
      mixer.current?.setMic(s);
      const all = await navigator.mediaDevices.enumerateDevices();
      setCams(all.filter((d) => d.kind === "videoinput"));
      setMics(all.filter((d) => d.kind === "audioinput"));
      setCamId(s.getVideoTracks()[0]?.getSettings().deviceId || "");
      setMicId(s.getAudioTracks()[0]?.getSettings().deviceId || "");
      setError("");
    } catch {
      setError("Allow camera and microphone access in your browser to continue.");
    }
  }, []);

  useEffect(() => {
    void openDevices();
  }, [openDevices]);

  const stopScreen = useCallback(() => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    comp.current?.setScreen(null);
    mixer.current?.setScreenAudio(null);
    setScreenOn(false);
  }, []);

  const shareScreen = async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      screenStream.current = s;
      comp.current?.setScreen(s);
      mixer.current?.setScreenAudio(s);
      s.getVideoTracks()[0].addEventListener("ended", stopScreen);
      setScreenOn(true);
      setLook((l) => (l.layout === "cam" ? { ...l, layout: "pip-br" } : l));
    } catch {
      /* cancelled */
    }
  };

  const toggleMic = () => {
    mixer.current?.muted(micOn);
    setMicOn(!micOn);
  };

  const stop = useCallback(async () => {
    setPhase("stopping");
    const id = sessionId.current;
    try {
      await fetch(`/api/sessions/${id}/stop`, { method: "POST" });
    } catch {}
    room.current?.disconnect();
    room.current = null;
    rememberId(id);
    void router.push(`/r/${id}`);
  }, [router]);

  const begin = async () => {
    setError("");
    if (!camStream.current) return setError("Camera and microphone are not ready yet.");
    await mixer.current?.resume();
    setPhase("countdown");
    for (let i = 3; i > 0; i--) {
      setCount(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setPhase("starting");
    try {
      const r = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hd }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not start.");
      sessionId.current = data.session.id;

      const lk = new Room();
      room.current = lk;
      await lk.connect(data.url, data.token);
      const v = await lk.localParticipant.publishTrack(new LocalVideoTrack(comp.current!.videoTrack()), {
        source: Track.Source.Camera,
        simulcast: false,
        videoEncoding: { maxBitrate: hd ? 8_000_000 : 5_000_000, maxFramerate: 30 },
        degradationPreference: "maintain-resolution",
      });
      const a = await lk.localParticipant.publishTrack(new LocalAudioTrack(mixer.current!.track()), { source: Track.Source.Microphone, dtx: false });
      const s = await fetch(`/api/sessions/${data.session.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoTrackId: v.trackSid, audioTrackId: a.trackSid }),
      });
      if (!s.ok) throw new Error((await s.json()).error || "Could not start the recorder.");

      // Wait until the recorder is really connected so the timer matches the video.
      for (let i = 0; i < 40; i++) {
        const st = await fetch(`/api/sessions/${data.session.id}`).then((x) => x.json());
        const view: View | undefined = st.session;
        if (view?.status === "failed") throw new Error(view.error || "The recorder failed.");
        if (view?.live) break;
        await new Promise((res) => setTimeout(res, 1000));
      }
      rememberId(data.session.id);
      setElapsed(0);
      setPhase("recording");
    } catch (e) {
      room.current?.disconnect();
      if (sessionId.current) void fetch(`/api/sessions/${sessionId.current}`, { method: "DELETE" });
      sessionId.current = "";
      setError(e instanceof Error ? e.message : "Could not start recording.");
      setPhase("setup");
    }
  };

  // Timer, 1 hour cap.
  useEffect(() => {
    if (phase !== "recording") return;
    const t0 = Date.now();
    const t = setInterval(() => {
      const sec = (Date.now() - t0) / 1000;
      setElapsed(sec);
      if (sec >= MAX_RECORD_SECONDS) {
        clearInterval(t);
        void stop();
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase, stop]);

  useEffect(() => {
    if (!recording) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recording]);

  const set = <K extends keyof Look>(k: K, v: Look[K]) => setLook((l) => ({ ...l, [k]: v }));
  const remaining = MAX_RECORD_SECONDS - elapsed;

  return (
    <main className="page">
      <header className="top">
        <span className="brand">Free Web Screen Recording Tool</span>
        <a href="/recordings">My recordings</a>
      </header>

      <div className="studio">
        <section className="stage-col">
          <div className="stage" ref={stage}>
            {phase === "countdown" && <div className="count">{count}</div>}
            {phase === "starting" && <div className="count small">Connecting</div>}
            {phase === "recording" && (
              <div className="rec">
                <b>REC</b> {clock(elapsed)} <span className="muted">of 1:00:00</span>
              </div>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="bar">
            {!recording && phase !== "stopping" ? (
              <button className="btn primary big" onClick={begin} disabled={phase === "countdown"}>
                Start recording
              </button>
            ) : (
              <button className="btn danger big" onClick={stop} disabled={phase !== "recording"}>
                {phase === "stopping" ? "Saving" : "Stop and save"}
              </button>
            )}
            <button className={`btn ${micOn ? "" : "off"}`} onClick={toggleMic}>
              {micOn ? "Mic on" : "Mic muted"}
            </button>
            <div className="meter" aria-hidden>
              <i style={{ width: `${micOn ? level * 100 : 0}%` }} />
            </div>
            <button className={`btn ${look.camOn ? "" : "off"}`} onClick={() => set("camOn", !look.camOn)}>
              {look.camOn ? "Camera on" : "Camera off"}
            </button>
            {screenOn ? (
              <button className="btn" onClick={stopScreen}>
                Stop sharing
              </button>
            ) : (
              <button className="btn" onClick={shareScreen}>
                Share screen
              </button>
            )}
          </div>
          {phase === "recording" && remaining < 300 && <p className="muted">Recording stops automatically in {clock(remaining)}.</p>}
        </section>

        <aside className="panel">
          <h2>Layout</h2>
          <div className="layouts">
            {LAYOUTS.map((l) => {
              const disabled = l.needsScreen && !screenOn;
              return (
                <button key={l.id} className={`layout ${look.layout === l.id ? "on" : ""}`} disabled={disabled} onClick={() => set("layout", l.id)} title={disabled ? "Share your screen first" : l.label}>
                  <span className={`thumb t-${l.id}`}>
                    <i className="s" />
                    <i className="c" />
                  </span>
                  <span>{l.label}</span>
                </button>
              );
            })}
          </div>

          <h2>Look</h2>
          <div className="row">
            <span>Background</span>
            <div className="swatches">
              {BACKGROUNDS.map((b) => (
                <button key={b.id} aria-label={b.label} title={b.label} className={look.bg === b.id ? "on" : ""} style={{ background: `linear-gradient(135deg, ${b.a}, ${b.b})` }} onClick={() => set("bg", b.id)} />
              ))}
            </div>
          </div>
          <div className="row">
            <span>Camera shape</span>
            <div className="seg">
              <button className={look.bubble === "circle" ? "on" : ""} onClick={() => set("bubble", "circle")}>Circle</button>
              <button className={look.bubble === "rounded" ? "on" : ""} onClick={() => set("bubble", "rounded")}>Rounded</button>
            </div>
          </div>
          <div className="row">
            <span>Camera size</span>
            <div className="seg">
              {(["S", "M", "L"] as const).map((s) => (
                <button key={s} className={look.size === s ? "on" : ""} onClick={() => set("size", s)}>{s}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <span>Padded frame</span>
            <div className="seg">
              <button className={look.frame ? "on" : ""} onClick={() => set("frame", true)}>On</button>
              <button className={!look.frame ? "on" : ""} onClick={() => set("frame", false)}>Off</button>
            </div>
          </div>
          <div className="row">
            <span>Mirror camera</span>
            <div className="seg">
              <button className={look.mirror ? "on" : ""} onClick={() => set("mirror", true)}>On</button>
              <button className={!look.mirror ? "on" : ""} onClick={() => set("mirror", false)}>Off</button>
            </div>
          </div>
          <div className="row">
            <span>Quality</span>
            <div className="seg">
              <button disabled={phase !== "setup"} className={!hd ? "on" : ""} onClick={() => setHd(false)}>720p</button>
              <button disabled={phase !== "setup"} className={hd ? "on" : ""} onClick={() => setHd(true)}>1080p</button>
            </div>
          </div>

          <h2>Devices</h2>
          <label className="field">
            Camera
            <select value={camId} disabled={recording} onChange={(e) => openDevices(e.target.value, micId)}>
              {cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>)}
            </select>
          </label>
          <label className="field">
            Microphone
            <select value={micId} disabled={recording} onChange={(e) => openDevices(camId, e.target.value)}>
              {mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
            </select>
          </label>
          <p className="muted note">Recordings are limited to 1 hour. After you stop, you have 6 hours to download the MP4 before it is deleted from our server.</p>
        </aside>
      </div>
    </main>
  );
}
