/** Mixes the microphone and (optionally) the shared screen's sound into the one audio track that gets recorded. */
export class AudioMixer {
  private ctx = new AudioContext();
  private dest = this.ctx.createMediaStreamDestination();
  private micGain = this.ctx.createGain();
  private analyser = this.ctx.createAnalyser();
  private micSrc: MediaStreamAudioSourceNode | null = null;
  private screenSrc: MediaStreamAudioSourceNode | null = null;
  private buf = new Uint8Array(128);

  constructor() {
    this.analyser.fftSize = 256;
    this.micGain.connect(this.dest);
    this.micGain.connect(this.analyser);
  }

  track() {
    return this.dest.stream.getAudioTracks()[0];
  }

  resume() {
    return this.ctx.resume();
  }

  setMic(stream: MediaStream | null) {
    this.micSrc?.disconnect();
    this.micSrc = null;
    if (stream && stream.getAudioTracks().length) {
      this.micSrc = this.ctx.createMediaStreamSource(stream);
      this.micSrc.connect(this.micGain);
    }
  }

  setScreenAudio(stream: MediaStream | null) {
    this.screenSrc?.disconnect();
    this.screenSrc = null;
    if (stream && stream.getAudioTracks().length) {
      this.screenSrc = this.ctx.createMediaStreamSource(stream);
      this.screenSrc.connect(this.dest);
    }
  }

  muted(m: boolean) {
    this.micGain.gain.value = m ? 0 : 1;
  }

  /** 0..1 microphone level for the meter. */
  level() {
    this.analyser.getByteTimeDomainData(this.buf);
    let peak = 0;
    for (const v of this.buf) peak = Math.max(peak, Math.abs(v - 128));
    return Math.min(1, peak / 64);
  }

  close() {
    void this.ctx.close();
  }
}
