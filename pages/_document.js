// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        {/* ===== Favicon & Meta ===== */}
        {/* Thiếu thẻ viewport này là nguyên nhân gốc gây lệch giao diện trên
            điện thoại (đặc biệt iPhone): không có nó, trình duyệt di động tự
            coi trang là trang desktop rộng rồi thu nhỏ lại để vừa màn hình,
            khiến các phần tử "position: fixed" (nút nhạc, nút thêm nhanh, nút
            lên đầu trang...) và nhiều chỗ khác bị tính sai vị trí, hiện lệch. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
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
