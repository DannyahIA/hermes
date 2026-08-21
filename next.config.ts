import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lets the dev server be reached from another device on the LAN (e.g.
  // testing on a phone) without Next's dev-origin protection blocking HMR
  // requests. Only affects `next dev` — irrelevant in production.
  allowedDevOrigins: process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(',') ?? [],
};

export default nextConfig;
