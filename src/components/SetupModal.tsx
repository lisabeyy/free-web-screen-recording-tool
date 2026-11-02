import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, GitHubIcon, TelegramIcon } from "./Icons";

const REPO = "https://github.com/lisabeyy/free-web-screen-recording-tool";

const COMMANDS = `git clone ${REPO}
cd free-web-screen-recording-tool
npm install
cp .env.example .env.local
npm run dev`;

/** Shown on the hosted demo instead of recording: explains how to run the tool locally for free. */
export function SetupModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMANDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Run it locally" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <h1>Record for free on your own computer</h1>
        <p className="muted">
          This page is a live preview, so you can try the layouts. Recording runs on your own free LiveKit and Mux accounts, which takes about 5 minutes to set up.
        </p>

        <ol className="steps">
          <li>
            <b>Get the code and start it</b>
            <pre>{COMMANDS}</pre>
            <button className="btn" onClick={copy}>{copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />} {copied ? "Copied" : "Copy commands"}</button>
          </li>
          <li>
            <b>Create a free LiveKit project</b> at <a href="https://cloud.livekit.io" target="_blank" rel="noreferrer">cloud.livekit.io</a>. In Settings, then Keys, create a key and copy the URL, API key and API secret into <code>.env.local</code>.
          </li>
          <li>
            <b>Create a Mux access token</b> at <a href="https://dashboard.mux.com" target="_blank" rel="noreferrer">dashboard.mux.com</a>. In Settings, then Access Tokens, give it Mux Video read and write, and copy the token ID and secret into <code>.env.local</code>.
          </li>
          <li>
            <b>Open</b> <code>http://localhost:4420</code> and press Start recording. Your video downloads as an MP4 and is deleted after 6 hours.
          </li>
        </ol>

        <div className="modal-actions">
          <a className="btn gh big" href={REPO} target="_blank" rel="noreferrer"><GitHubIcon /> Get the code on GitHub</a>
          <a className="btn tg big" href="https://t.me/lisabeyy" target="_blank" rel="noreferrer"><TelegramIcon /> Need help setting it up? DM me</a>
        </div>
      </div>
    </div>
  );
}
