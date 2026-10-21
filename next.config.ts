import { networkInterfaces } from 'node:os';

import type { NextConfig } from 'next';

/**
 * This machine's own network addresses (Wi-Fi, cable, Tailscale…). They
 * change with the network the machine is on, so they're allowed without
 * having to be listed in NEXT_DEV_ALLOWED_ORIGINS. Read when the dev
 * server starts: after switching networks, restart it.
 */
function ownAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address) => address && !address.internal)
    .map((address) => address!.address);
}

const nextConfig: NextConfig = {
  // Lets the dev server be reached from another device on the LAN (e.g.
  // testing on a phone) without Next's dev-origin protection blocking its
  // scripts and HMR — a page whose scripts are blocked renders, but nothing
  // on it can be clicked. Only affects `next dev` — irrelevant in production.
  allowedDevOrigins: [
    ...ownAddresses(),
    ...(process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(',') ?? []),
  ],
};

export default nextConfig;
