import type { AppProps } from "next/app";
import Head from "next/head";
import "@/styles/globals.css";
import { GitHubIcon, HeartIcon, TelegramIcon } from "@/components/Icons";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Free Web Screen Recording Tool</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
      <footer className="foot">
        <p>Free to use. Hosting costs real money, so if it saves you time, help keep it running.</p>
        <div className="foot-links">
          <a className="pill gh" href="https://github.com/lisabeyy/free-web-screen-recording-tool" target="_blank" rel="noreferrer">
            <GitHubIcon /> Star on GitHub
          </a>
          <a className="pill tip" href="https://pay.loofta.com/me/@lisabeyy" target="_blank" rel="noreferrer">
            <HeartIcon /> Support the project
          </a>
          <a className="pill tg" href="https://t.me/lisabeyy" target="_blank" rel="noreferrer">
            <TelegramIcon /> Need help setting it up? DM me
          </a>
        </div>
      </footer>
    </>
  );
}
