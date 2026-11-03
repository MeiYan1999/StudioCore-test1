import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/marketing/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/manage/", "/api/", "/share/", "/demo", "/reset-password"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
