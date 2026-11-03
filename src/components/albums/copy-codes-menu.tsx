"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COPY_FORMAT_LABELS,
  formatPhotoCodes,
  type CopyCodeItem,
  type CopyFormat,
} from "@/lib/share/copy-formats";
import { copyToClipboard } from "@/lib/utils/clipboard";

export function CopyCodesMenu({
  items,
  label = "Copy mã",
  size = "sm",
  variant = "outline",
}: {
  items: CopyCodeItem[];
  label?: string;
  size?: "default" | "sm";
  variant?: "primary" | "outline" | "secondary" | "ghost";
}) {
  const formats = Object.keys(COPY_FORMAT_LABELS) as CopyFormat[];

  const copy = async (format: CopyFormat, includeNotes: boolean) => {
    if (items.length === 0) {
      toast.error("Chưa có mã ảnh nào để copy.");
      return;
    }
    const text = formatPhotoCodes(items, format, includeNotes);
    const copied = await copyToClipboard(text);
    toast[copied ? "success" : "error"](
      copied
        ? `Đã copy ${items.length} mã ảnh (${COPY_FORMAT_LABELS[format].toLowerCase()}${includeNotes ? ", kèm ghi chú" : ""}).`
        : "Trình duyệt không cho phép copy tự động.",
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Copy className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Chỉ mã ảnh</DropdownMenuLabel>
        {formats.map((format) => (
          <DropdownMenuItem key={format} onSelect={() => void copy(format, false)}>
            {COPY_FORMAT_LABELS[format]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Kèm ghi chú</DropdownMenuLabel>
        {formats.map((format) => (
          <DropdownMenuItem key={`notes-${format}`} onSelect={() => void copy(format, true)}>
            {COPY_FORMAT_LABELS[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
