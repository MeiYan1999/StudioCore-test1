import type { Metadata } from "next";
import { siteUrl } from "./content";

export function marketingMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteUrl()}${input.path}`;
  const image = `${siteUrl()}${input.image ?? "/marketing/dashboard.jpg"}`;
  return {
    title: { absolute: input.title },
    description: input.description,
    alternates: { canonical: url },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url,
      siteName: "StudioCore",
      title: { absolute: input.title },
      description: input.description,
      images: [{ url: image, width: 1440, height: 810, alt: "StudioCore" }],
    },
    twitter: {
      card: "summary_large_image",
      title: { absolute: input.title },
      description: input.description,
      images: [image],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StudioCore",
    url: siteUrl(),
    logo: `${siteUrl()}/icon.svg`,
    description:
      "Nền tảng quản lý studio chụp ảnh: CRM, đơn hàng, lịch chụp, PhotoShare, tài chính và vận hành.",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@studiocore.demo",
        availableLanguage: ["vi"],
      },
    ],
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "StudioCore",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteUrl(),
    description:
      "Phần mềm quản lý studio chụp ảnh: CRM, đơn hàng, lịch chụp chống trùng, PhotoShare, báo cáo và nhân sự.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "VND",
      description: "Gói dùng thử demo 14 ngày",
    },
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  slug: string;
  date: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    datePublished: input.date,
    dateModified: input.date,
    author: { "@type": "Organization", name: "StudioCore" },
    publisher: { "@type": "Organization", name: "StudioCore" },
    mainEntityOfPage: `${siteUrl()}/blog/${input.slug}`,
  };
}
