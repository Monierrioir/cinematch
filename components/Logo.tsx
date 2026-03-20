import type { SVGProps } from "react";

type LogoProps = {
  className?: string;
  showText?: boolean;
} & SVGProps<SVGSVGElement>;

export default function Logo({ className = "", showText = true, ...props }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 44 44"
        aria-hidden="true"
        className="h-8 w-8 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <defs>
          <linearGradient id="cineMatchGradient" x1="6" y1="6" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
        </defs>

        <rect x="5" y="5" width="34" height="34" rx="10" stroke="url(#cineMatchGradient)" strokeWidth="2.5" />

        <path
          d="M17 14L29 22L17 30V14Z"
          fill="url(#cineMatchGradient)"
          className="drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]"
        />

        <circle cx="12" cy="12" r="1.3" fill="#38BDF8" />
        <circle cx="12" cy="18" r="1.3" fill="#38BDF8" />
        <circle cx="12" cy="24" r="1.3" fill="#38BDF8" />
        <circle cx="12" cy="30" r="1.3" fill="#38BDF8" />
      </svg>

      {showText && (
        <span className="font-heading text-2xl tracking-wider text-white">
          Cine<span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">Match</span>
        </span>
      )}
    </div>
  );
}
