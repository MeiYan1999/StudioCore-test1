"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
}

export function LiquidGlassCard({
  children,
  className,
  tilt = true,
  ...props
}: LiquidGlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !tilt) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5; // max 5deg tilt
    const rotateY = ((x - centerX) / centerX) * 5;

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(6px)`,
      transition: "transform 0.1s ease-out",
    });

    setGlareStyle({
      opacity: 1,
      background: `radial-gradient(circle 320px at ${x}px ${y}px, rgba(255, 255, 255, 0.45), transparent 75%)`,
      transition: "opacity 0.2s ease-out",
    });
  };

  const handleMouseLeave = () => {
    if (!tilt) return;

    setStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)",
      transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    });

    setGlareStyle({
      opacity: 0,
      transition: "opacity 0.4s ease-out",
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={cn("liquid-glass-card group", className)}
      {...props}
    >
      {/* Specular Glare Layer (Apple Light Reflection) */}
      <div
        className="pointer-events-none absolute -inset-px z-10 rounded-[inherit] transition-opacity duration-300"
        style={glareStyle}
        aria-hidden="true"
      />
      <div className="relative z-20 h-full">{children}</div>
    </div>
  );
}
