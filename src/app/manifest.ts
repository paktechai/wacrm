import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SBYT CRM",
    short_name: "SBYT CRM",
    description: "AI-powered customer engagement, CRM, marketing and automation by Sajid Byte Tech Solutions.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#07090d",
    theme_color: "#07090d",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/sbyt-pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/sbyt-pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
