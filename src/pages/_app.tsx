import type { AppProps } from "next/app";
import Head from "next/head";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Free Web Screen Recording Tool</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
      <footer className="foot">
        <span>Free to use. Hosting costs real money, help keep it running: </span>
        <a href="https://pay.loofta.com/me/@lisabeyy" target="_blank" rel="noreferrer">pay.loofta.com/me/@lisabeyy</a>
        <span> · Need help setting it up? </span>
        <a href="https://t.me/lisabeyy" target="_blank" rel="noreferrer">t.me/lisabeyy</a>
        <span> · </span>
        <a href="https://github.com/lisabeyy/free-web-screen-recording-tool" target="_blank" rel="noreferrer">Source</a>
      </footer>
    </>
  );
}
