import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Allow any external image domain (owner-uploaded gym photos)
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  compress: true,
  async redirects() {
    return [
      { source: "/blog", destination: "/resources", permanent: true },
      { source: "/blog/:slug", destination: "/resources/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
