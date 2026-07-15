import type { NextConfig } from "next";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Bubble Hex is a client-only arcade game. On Vercel, emit a portable static
  // site instead of a Cloudflare Worker/server bundle. The existing Sites build
  // remains unchanged outside Vercel.
  ...(isVercelBuild
    ? {
        output: "export" as const,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
