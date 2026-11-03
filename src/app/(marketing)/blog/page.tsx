import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { formatDate } from "@/lib/utils";

export const metadata = marketingMetadata({
  title: "Blog vận hành studio chụp ảnh — StudioCore",
  description:
    "Bài viết thực tế về vận hành studio, lịch chụp, CRM, PhotoShare và quản lý tài chính.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Blog</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Ghi chú vận hành studio.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Nội dung tiếng Việt do StudioCore biên soạn, tập trung vào quy trình và
            quyết định thực tế. Không sao chép nội dung từ sản phẩm khác.
          </p>
        </div>
      </section>
      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto grid max-w-[1240px] gap-5 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          {BLOG_POSTS.map((post) => (
            <article key={post.slug} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{post.category}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(post.date)} · {post.readMinutes} phút đọc
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold leading-snug">
                <Link href={`/blog/${post.slug}`} className="hover:text-primary">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {post.description}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                Đọc bài viết <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-[1240px] px-4 text-center sm:px-6 lg:px-8">
          <Button asChild variant="outline">
            <Link href="/guide">Xem thư viện hướng dẫn</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
