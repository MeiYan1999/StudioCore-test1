import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS, getBlogPost } from "@/lib/marketing/content";
import {
  articleJsonLd,
  marketingMetadata,
} from "@/lib/marketing/metadata";
import { formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Không tìm thấy bài viết" };
  return marketingMetadata({
    title: `${post.title} — StudioCore Blog`,
    description: post.description,
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();
  const related = BLOG_POSTS.filter((item) => item.slug !== post.slug).slice(0, 2);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleJsonLd({
              title: post.title,
              description: post.description,
              slug: post.slug,
              date: post.date,
            }),
          ),
        }}
      />
      <article className="mx-auto max-w-[860px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Blog
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="info">{post.category}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(post.date)} · {post.readMinutes} phút đọc
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{post.description}</p>
        <div className="mt-8 space-y-7">
          {post.sections.map((section, index) => (
            <section key={index}>
              {section.heading ? (
                <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              ) : null}
              {section.paragraphs.map((paragraph, pIndex) => (
                <p key={pIndex} className="mt-2 text-sm leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        <div className="mt-10 rounded-2xl border border-primary/30 bg-accent p-5">
          <h2 className="text-lg font-semibold">Muốn xem các bước này trong app?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mở demo read-only hoặc tạo tenant trial. Dữ liệu demo là synthetic và
            mọi thao tác ghi trong demo đều bị chặn.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild><Link href="/demo">Mở demo</Link></Button>
            <Button asChild variant="outline"><Link href="/register">Đăng ký dùng thử</Link></Button>
          </div>
        </div>

        <section className="mt-10 border-t border-border pt-6">
          <h2 className="text-lg font-semibold">Đọc tiếp</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/blog/${item.slug}`}
                className="rounded-xl border border-border bg-surface p-4 hover:shadow-md"
              >
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                  Đọc tiếp <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}
