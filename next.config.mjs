/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Don't cache the HTML shell so the PWA always loads the latest
        // JS bundles after a Vercel deployment
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
