# Free Web Screen Recording Tool

Record your screen and camera in the browser, choose your layout, and download the MP4. Free, no account, a bit like Tella.

- Camera and screen at the same time, with live layouts: camera only, screen only, screen with a camera bubble, side by side, camera with a small screen
- Custom backgrounds, padded frame, circle or rounded camera, mirror, 720p or 1080p
- Records up to **1 hour** per session
- Download your MP4 within **6 hours**, then it is deleted from the server automatically (no storage kept)

**Use my hosted version:** https://free-web-screen-recording-tool.fly.dev

## How it works

Your browser draws the camera and screen onto one canvas using the layout you picked. That canvas and your mixed audio are published to **LiveKit**, a LiveKit egress streams them to **Mux**, and Mux records the stream into an MP4. A sweeper deletes every recording from Mux 6 hours after it ends.

## Run it locally

You need Node 20+ and two free accounts (LiveKit and Mux).

```bash
git clone https://github.com/lisabeyy/free-web-screen-recording-tool
cd free-web-screen-recording-tool
npm install
cp .env.example .env.local   # then fill in the 5 values below
npm run dev                  # http://localhost:4420
```

## Where to get the environment variables

### LiveKit (3 variables)

1. Create a free account at https://cloud.livekit.io and create a project.
2. Open the project, go to **Settings**, then **Keys**, and create a key.
3. Copy the values:
   - `LIVEKIT_URL` is the project URL, starting with `wss://` (for example `wss://my-project-abc123.livekit.cloud`)
   - `LIVEKIT_API_KEY` is the API key
   - `LIVEKIT_API_SECRET` is the API secret (shown once, save it)

Egress (streaming out to Mux) is included in LiveKit Cloud. Check your plan's egress minutes if you record a lot.

### Mux (2 variables)

1. Create an account at https://dashboard.mux.com and make sure the environment is a **production** one, not a test one (test mode limits recordings to about 10 seconds).
2. Go to **Settings**, then **Access Tokens**, and click **Generate new token**.
3. Give it **Mux Video** permissions with **Read and Write**.
4. Copy the values:
   - `MUX_TOKEN_ID` is the Access Token ID
   - `MUX_TOKEN_SECRET` is the Secret Key (shown once, save it)

Mux needs a payment method for live streaming and recording on most plans. Cost is small because recordings are deleted after 6 hours.

### Optional limits

| Variable | Default | What it does |
| --- | --- | --- |
| `MAX_SESSIONS_PER_IP_HOUR` | 6 | Recordings one visitor can start per hour |
| `MAX_CONCURRENT_RECORDINGS` | 5 | Recordings allowed at the same time |

## Deploy your own on Fly.io

```bash
fly launch --no-deploy --copy-config      # pick your own app name when asked
fly volumes create recorder_data --size 1 --region fra
fly secrets set LIVEKIT_URL=wss://... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... MUX_TOKEN_ID=... MUX_TOKEN_SECRET=...
fly deploy
```

The volume keeps the list of recordings between restarts, so expired ones are always deleted from Mux. Keep the Fly app at one machine.

Anyone with the link can start a recording on your accounts, so keep the limits above in place for a public deployment.

## Contribute and maintain

This tool is free to use. Hosting, LiveKit and Mux cost real money, so if it saves you time, you can help keep it running:

**Tip or sponsor: https://pay.loofta.com/me/@lisabeyy**

Pull requests and issues are welcome.

## Need help setting it up?

Message me on Telegram: https://t.me/lisabeyy
