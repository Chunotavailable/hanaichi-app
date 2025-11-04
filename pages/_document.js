// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        {/* ===== Favicon & Meta ===== */}
        {/* <link rel="icon" href="/favicon.ico" sizes="any" /> */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <meta name="theme-color" content="#F9CFE1" />
        <meta name="description" content="Hanaichi - Thời trang có sẵn" />
        <meta property="og:title" content="Hanaichi Web App" />
        <meta
          property="og:description"
          content="Hệ thống hiển thị danh mục sản phẩm đồng bộ từ Google Sheets."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/favicon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
