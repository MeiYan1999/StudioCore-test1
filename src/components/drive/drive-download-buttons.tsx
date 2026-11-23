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
  const [primaryPlatforms, setPrimaryPlatforms] = useState<DownloadPlatform[]>(["windows"]);
  const [showMacHint, setShowMacHint] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("windows")) return;

    if (!userAgent.includes("macintosh") && !userAgent.includes("mac os x")) return;

    const showAllMacChoices = () => {
      void Promise.resolve().then(() => {
        setPrimaryPlatforms(["macArm64", "macX64"]);
        setShowMacHint(true);
      });
    };
    const userAgentData = (navigator as NavigatorWithUserAgentData).userAgentData;
    if (!userAgentData?.getHighEntropyValues) {
      showAllMacChoices();
      return;
    }

    void Promise.resolve()
      .then(() => userAgentData.getHighEntropyValues(["architecture"]))
      .then(
        ({ architecture }) => {
          if (architecture === "arm") {
            setPrimaryPlatforms(["macArm64"]);
            setShowMacHint(false);
          } else if (architecture === "x86") {
            setPrimaryPlatforms(["macX64"]);
            setShowMacHint(false);
          } else {
            setPrimaryPlatforms(["macArm64", "macX64"]);
            setShowMacHint(true);
          }
        },
        showAllMacChoices,
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
            variant={primaryPlatforms.includes(platform) ? "primary" : "outline"}
            className={compact ? "w-full" : undefined}
          >
            <a href={href}>{label}</a>
          </Button>
        ))}
      </div>
      {showMacHint ? (
        <p
          className={
            compact ? "text-center text-xs text-muted-foreground" : "mt-2 text-center text-xs text-muted-foreground"
          }
        >
          Chưa rõ máy dùng chip gì? Bấm Apple menu › Giới thiệu về máy Mac: ghi “Apple M…” thì chọn chip Apple, ghi
          “Intel” thì chọn chip Intel.
        </p>
      ) : null}
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
