// app/manifest.js — Next.js web app manifest (makes RoadGame installable).
export default function manifest() {
  return {
    name: "RoadGame",
    short_name: "RoadGame",
    description: "Plan your sports road trips — find games, book travel, and follow your favorite teams.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#2D3A42",
    theme_color: "#2D3A42",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
