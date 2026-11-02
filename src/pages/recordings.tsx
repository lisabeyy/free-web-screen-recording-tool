import { useEffect, useState } from "react";
import { clock, forgetId, savedIds, timeLeft, type View } from "@/lib/client";

export default function Recordings() {
  const [items, setItems] = useState<View[] | null>(null);

  useEffect(() => {
    (async () => {
      const out: View[] = [];
      for (const id of savedIds()) {
        const r = await fetch(`/api/sessions/${id}`);
        if (r.ok) out.push((await r.json()).session);
        else forgetId(id);
      }
      setItems(out);
    })();
  }, []);

  return (
    <main className="page">
      <header className="top">
        <a className="brand" href="/">Free Web Screen Recording Tool</a>
        <a href="/">New recording</a>
      </header>
      <div className="narrow">
        <h1>My recordings</h1>
        <p className="muted">Recordings are deleted 6 hours after they end.</p>
        {items === null ? (
          <p className="muted">Loading</p>
        ) : items.length === 0 ? (
          <p className="muted">Nothing here yet.</p>
        ) : (
          <ul className="list">
            {items.map((v) => (
              <li key={v.id}>
                <a href={`/r/${v.id}`}>
                  <b>{new Date(v.createdAt).toLocaleString()}</b>
                  <span className="muted">
                    {v.status === "ready" ? `${v.duration ? clock(v.duration) + " · " : ""}deleted in ${v.expiresAt ? timeLeft(v.expiresAt - Date.now()) : "6h"}` : v.status}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
