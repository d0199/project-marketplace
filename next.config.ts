import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Allow any external image domain (owner-uploaded gym photos)
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  compress: true,
};

export default nextConfig;
