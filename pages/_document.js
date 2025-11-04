import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        {/* <link rel="icon" href="/favicon.ico" sizes="any" /> */}
        {/* Nếu dùng PNG */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <meta name="theme-color" content="#F9CFE1" />
        <meta name="description" content="hanaichi-ss.vercel.app" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
