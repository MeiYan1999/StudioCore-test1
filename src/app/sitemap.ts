import type { MetadataRoute } from "next";
import { BLOG_POSTS, siteUrl } from "@/lib/marketing/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const staticPaths = [
    "/",
    "/phan-mem-quan-ly-studio",
    "/crm-studio-chup-anh",
    "/pricing",
    "/guide",
    "/blog",
    "/contact",
    "/terms",
    "/privacy",
  ];
  return [
    ...staticPaths.map((path) => ({
      url: `${base}${path}`,
      lastModified: new Date("2026-11-03"),
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.7,
    })),
    ...BLOG_POSTS.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
