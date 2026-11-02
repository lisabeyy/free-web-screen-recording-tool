export type LayoutId = "cam" | "screen" | "pip-br" | "pip-bl" | "side" | "cam-main";
export type BubbleShape = "circle" | "rounded";
export type BubbleSize = "S" | "M" | "L";

export const LAYOUTS: { id: LayoutId; label: string; needsScreen: boolean }[] = [
  { id: "cam", label: "Camera", needsScreen: false },
  { id: "screen", label: "Screen", needsScreen: true },
  { id: "pip-br", label: "Screen + bubble right", needsScreen: true },
  { id: "pip-bl", label: "Screen + bubble left", needsScreen: true },
  { id: "side", label: "Side by side", needsScreen: true },
  { id: "cam-main", label: "Camera + small screen", needsScreen: true },
];

export const BACKGROUNDS = [
  { id: "violet", label: "Violet", a: "#6d28d9", b: "#db2777" },
  { id: "ocean", label: "Ocean", a: "#0ea5e9", b: "#6366f1" },
  { id: "sunset", label: "Sunset", a: "#f97316", b: "#e11d48" },
  { id: "forest", label: "Forest", a: "#059669", b: "#0f766e" },
  { id: "slate", label: "Slate", a: "#1e293b", b: "#0f172a" },
  { id: "paper", label: "Paper", a: "#f1f5f9", b: "#e2e8f0" },
] as const;

export type Look = {
  layout: LayoutId;
  bubble: BubbleShape;
  size: BubbleSize;
  bg: (typeof BACKGROUNDS)[number]["id"];
  frame: boolean; // screen sits on the background with padding and rounded corners
  mirror: boolean;
  camOn: boolean;
};

export const DEFAULT_LOOK: Look = { layout: "pip-br", bubble: "circle", size: "M", bg: "violet", frame: true, mirror: true, camOn: true };

type Rect = { x: number; y: number; w: number; h: number };

function rrect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

function dims(v: HTMLVideoElement) {
  return { w: v.videoWidth || 16, h: v.videoHeight || 9 };
}

/** Draws the camera and screen onto a canvas using the chosen layout. The canvas is what gets recorded. */
export class Compositor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cam = document.createElement("video");
  private screen = document.createElement("video");
  private worker: Worker | null = null;
  look: Look = { ...DEFAULT_LOOK };
  hasCam = false;
  hasScreen = false;

  constructor(public width = 1280, public height = 720) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.ctx.imageSmoothingQuality = "high";
    for (const v of [this.cam, this.screen]) {
      v.muted = true;
      v.playsInline = true;
    }
  }

  setSize(hd: boolean) {
    this.width = hd ? 1920 : 1280;
    this.height = hd ? 1080 : 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  setCamera(stream: MediaStream | null) {
    this.cam.srcObject = stream;
    this.hasCam = Boolean(stream);
    if (stream) void this.cam.play().catch(() => {});
  }

  setScreen(stream: MediaStream | null) {
    this.screen.srcObject = stream;
    this.hasScreen = Boolean(stream);
    if (stream) void this.screen.play().catch(() => {});
  }

  /** A worker clock keeps drawing at full speed even when this tab is in the background (e.g. while you present another window). */
  start() {
    if (this.worker) return;
    const src = "let t=setInterval(()=>postMessage(0),1000/30);onmessage=()=>clearInterval(t)";
    this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    this.worker.onmessage = () => this.draw();
  }

  stop() {
    this.worker?.postMessage("stop");
    this.worker?.terminate();
    this.worker = null;
  }

  videoTrack() {
    const track = this.canvas.captureStream(30).getVideoTracks()[0];
    track.contentHint = "detail"; // screen text: keep sharpness over smoothness
    return track;
  }

  private bubbleDiameter() {
    return this.height * { S: 0.22, M: 0.3, L: 0.4 }[this.look.size];
  }

  private effectiveLayout(): LayoutId {
    const l = this.look.layout;
    return !this.hasScreen && LAYOUTS.find((x) => x.id === l)?.needsScreen ? "cam" : l;
  }

  draw() {
    const { ctx, width: W, height: H, look } = this;
    const bg = BACKGROUNDS.find((b) => b.id === look.bg) || BACKGROUNDS[0];
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, bg.a);
    g.addColorStop(1, bg.b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const pad = look.frame ? Math.round(H * 0.06) : 0;
    const full: Rect = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
    const layout = this.effectiveLayout();
    const m = Math.round(H * 0.04);

    if (layout === "cam") return this.drawCam(full, look.frame ? 24 : 0);
    if (layout === "screen") return this.drawScreen(full);
    if (layout === "pip-br" || layout === "pip-bl") {
      this.drawScreen(full);
      if (look.camOn && this.hasCam) {
        const d = this.bubbleDiameter();
        const w = look.bubble === "circle" ? d : d * 1.33;
        const x = layout === "pip-br" ? W - w - m - pad / 2 : m + pad / 2;
        this.drawCam({ x, y: H - d - m - pad / 2, w, h: d }, look.bubble === "circle" ? d / 2 : 22, true);
      }
      return;
    }
    if (layout === "side") {
      const camW = look.camOn && this.hasCam ? Math.round(full.w * 0.27) : 0;
      const gap = camW ? Math.round(H * 0.03) : 0;
      this.drawScreen({ ...full, w: full.w - camW - gap });
      if (camW) {
        const ch = Math.min(full.h, Math.round(camW * 1.25));
        this.drawCam({ x: full.x + full.w - camW, y: full.y + (full.h - ch) / 2, w: camW, h: ch }, look.bubble === "circle" ? 40 : 22, true);
      }
      return;
    }
    // cam-main: camera large, screen as a small card
    this.drawCam(full, look.frame ? 24 : 0);
    const sw = Math.round(full.w * 0.32);
    const sh = Math.round((sw * 9) / 16);
    this.drawScreen({ x: full.x + full.w - sw - m, y: full.y + full.h - sh - m, w: sw, h: sh }, true);
  }

  private drawCam(r: Rect, radius: number, shadow = false) {
    const { ctx, look } = this;
    ctx.save();
    if (shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 6;
    }
    rrect(ctx, r, radius);
    ctx.fillStyle = "#111114";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.clip();
    if (this.hasCam && look.camOn && this.cam.readyState >= 2) {
      const { w, h } = dims(this.cam);
      const scale = Math.max(r.w / w, r.h / h);
      const dw = w * scale;
      const dh = h * scale;
      const dx = r.x + (r.w - dw) / 2;
      const dy = r.y + (r.h - dh) / 2;
      if (look.mirror) {
        ctx.translate(r.x * 2 + r.w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(this.cam, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Camera off", r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.restore();
  }

  private drawScreen(r: Rect, card = false) {
    const { ctx, look } = this;
    ctx.save();
    if (look.frame || card) {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 32;
      ctx.shadowOffsetY = 10;
    }
    if (!this.hasScreen || this.screen.readyState < 2) {
      rrect(ctx, r, 18);
      ctx.fillStyle = "#111114";
      ctx.fill();
      ctx.restore();
      return;
    }
    const { w, h } = dims(this.screen);
    const scale = Math.min(r.w / w, r.h / h);
    const dw = w * scale;
    const dh = h * scale;
    const box: Rect = { x: r.x + (r.w - dw) / 2, y: r.y + (r.h - dh) / 2, w: dw, h: dh };
    rrect(ctx, box, look.frame || card ? 18 : 0);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.clip();
    ctx.drawImage(this.screen, box.x, box.y, box.w, box.h);
    ctx.restore();
  }
}
