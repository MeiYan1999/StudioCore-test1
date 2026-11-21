import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudioCore — Quản lý studio chụp ảnh",
    short_name: "StudioCore",
    description:
      "Nền tảng quản lý studio chụp ảnh: khách hàng, đơn hàng, lịch chụp, album, tài chính và nhân sự.",
    start_url: "/manage/dashboard",
    display: "standalone",
    background_color: "#f3f4f7",
    theme_color: "#0056B2",
    lang: "vi",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
