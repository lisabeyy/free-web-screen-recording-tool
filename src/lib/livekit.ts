import { AccessToken, EgressClient, EncodingOptions, EgressStatus, StreamOutput, StreamProtocol, RoomServiceClient } from "livekit-server-sdk";
import { RTMP_URL } from "./mux";

const URL = process.env.LIVEKIT_URL || "";
const KEY = process.env.LIVEKIT_API_KEY || "";
const SECRET = process.env.LIVEKIT_API_SECRET || "";

export const livekitEnabled = Boolean(URL && KEY && SECRET);
export const livekitUrl = URL;
const http = () => URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

export const makeToken = (room: string, identity: string) => {
  const at = new AccessToken(KEY, SECRET, { identity, ttl: "3h" });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: false });
  return at.toJwt();
};

/** Streams the published canvas video + mixed audio tracks into Mux, which records them. */
export async function startRecording(room: string, streamKey: string, videoTrackId: string, audioTrackId: string, hd: boolean) {
  const egress = new EgressClient(http(), KEY, SECRET);
  const out = new StreamOutput({ protocol: StreamProtocol.RTMP, urls: [`${RTMP_URL}/${streamKey}`] });
  const info = await egress.startTrackCompositeEgress(room, out, {
    videoTrackId,
    audioTrackId,
    encodingOptions: new EncodingOptions({
      width: hd ? 1920 : 1280,
      height: hd ? 1080 : 720,
      framerate: 30,
      videoBitrate: hd ? 8000 : 5000,
      audioBitrate: 128,
      keyFrameInterval: 2,
    }),
  });
  return info.egressId;
}

export async function egressIsActive(egressId: string) {
  const egress = new EgressClient(http(), KEY, SECRET);
  const [info] = await egress.listEgress({ egressId });
  return { active: info?.status === EgressStatus.EGRESS_ACTIVE, failed: info?.status === EgressStatus.EGRESS_FAILED, error: info?.error };
}

export async function stopRecording(egressId: string, room: string) {
  const egress = new EgressClient(http(), KEY, SECRET);
  await egress.stopEgress(egressId).catch(() => undefined);
  await new RoomServiceClient(http(), KEY, SECRET).deleteRoom(room).catch(() => undefined);
}
