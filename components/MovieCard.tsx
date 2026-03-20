"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { getPosterUrl } from "@/lib/image";

type MovieCardProps = {
  title: string;
  year?: string;
  rating?: number;
  posterPath?: string | null;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export default function MovieCard({
  title,
  year,
  rating,
  posterPath,
  isSelected = false,
  onClick,
  disabled = false,
  children
}: MovieCardProps) {
  const baseClassName =
    "group relative overflow-hidden rounded-xl border bg-slate-900/85 shadow-lg transition-all duration-300 ease-out hover:scale-105";
  const selectedClassName = isSelected
    ? "border-brand-500/90 shadow-[0_0_25px_rgba(56,93,255,0.35)]"
    : "border-slate-800 hover:border-indigo-400/60";
  const disabledClassName = disabled ? "cursor-not-allowed opacity-70 hover:scale-100" : "";
  const cardClassName = `${baseClassName} ${selectedClassName} ${disabledClassName}`;
  const formattedRating = typeof rating === "number" ? rating.toFixed(1) : "N/A";

  const content = (
    <>
      <div className="relative w-full bg-slate-800">
        <Image
          src={getPosterUrl(posterPath)}
          alt={title}
          width={500}
          height={750}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
          className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/55" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-3 px-3 pb-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="line-clamp-2 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-200">{year ?? "Unknown year"}</p>
          <p className="mt-1 text-xs font-medium text-sky-300">Rating: {formattedRating}</p>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-400">{year ?? "Unknown year"}</p>
        {children}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={`${cardClassName} text-left`}>
        {content}
      </button>
    );
  }

  return <article className={cardClassName}>{content}</article>;
}
