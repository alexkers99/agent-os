/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Agent loops + tool calls are long-running; keep them on the Node runtime.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
