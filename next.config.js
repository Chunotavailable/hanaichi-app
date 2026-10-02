/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Các thư viện đọc sheet (lib/*Sheet.js) cũng chạy được ở trình duyệt; phần đọc file trên đĩa (fs) chỉ dùng khi thử trên máy.
  webpack(config, { isServer }) {
    if (!isServer) config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false };
    return config;
  },
};
module.exports = nextConfig;
