"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DRIVE_DOWNLOADS, DRIVE_RELEASES_URL } from "@/lib/drive/constants";

type DownloadPlatform = keyof typeof DRIVE_DOWNLOADS;

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    getHighEntropyValues: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};

const DOWNLOAD_BUTTONS: { platform: DownloadPlatform; label: string; href: string }[] = [
  { platform: "windows", label: "Windows", href: DRIVE_DOWNLOADS.windows },
  { platform: "macArm64", label: "macOS (chip Apple M1–M4)", href: DRIVE_DOWNLOADS.macArm64 },
  { platform: "macX64", label: "macOS (chip Intel)", href: DRIVE_DOWNLOADS.macX64 },
];

type Props = {
  compact?: boolean;
};

export function DriveDownloadButtons({ compact = false }: Props) {
  const [primaryPlatform, setPrimaryPlatform] = useState<DownloadPlatform>("windows");

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("windows")) return;

    if (!userAgent.includes("macintosh") && !userAgent.includes("mac os x")) return;

    void Promise.resolve().then(() => setPrimaryPlatform("macArm64"));
    const userAgentData = (navigator as NavigatorWithUserAgentData).userAgentData;
    if (!userAgentData?.getHighEntropyValues) return;

    void Promise.resolve()
      .then(() => userAgentData.getHighEntropyValues(["architecture"]))
      .then(
        ({ architecture }) => {
          if (architecture === "x86") setPrimaryPlatform("macX64");
        },
        () => undefined,
      );
  }, []);

  return (
    <div className={compact ? "space-y-2" : undefined}>
      <div className={compact ? "grid gap-2" : "flex flex-wrap justify-center gap-3"}>
        {DOWNLOAD_BUTTONS.map(({ platform, label, href }) => (
          <Button
            key={platform}
            asChild
            size={compact ? "default" : "lg"}
            variant={primaryPlatform === platform ? "primary" : "outline"}
            className={compact ? "w-full" : undefined}
          >
            <a href={href}>{label}</a>
          </Button>
        ))}
      </div>
      <p
        className={
          compact ? "text-center text-xs text-muted-foreground" : "mt-2 text-center text-xs text-muted-foreground"
        }
      >
        <a
          className="underline underline-offset-4 hover:text-foreground"
          href={DRIVE_RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Các phiên bản khác
        </a>
      </p>
    </div>
  );
}
