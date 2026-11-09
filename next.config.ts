import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@paypal/agent-toolkit"],
  // Allow opening the dev server from another device on the LAN (e.g. http://192.168.x.x:3000).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};
export default nextConfig;
