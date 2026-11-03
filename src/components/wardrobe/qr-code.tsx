"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      marginSize={2}
      title={`Mã QR ${value}`}
      className="rounded-lg bg-white p-2"
    />
  );
}
