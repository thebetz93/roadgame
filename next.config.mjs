/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Don't cache the HTML shell so the PWA always loads the latest
        // JS bundles after a Vercel deployment
        source: "/",
        // no-cache: always revalidate, but serve stale if network fails (no must-revalidate)
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
