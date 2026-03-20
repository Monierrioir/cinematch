"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`app-navbar sticky top-0 z-40 ${scrolled ? "is-scrolled" : ""}`}>
      <div className="app-shell flex h-16 items-center justify-between md:h-[4.4rem]">
        <Link href="/" className="app-logo">
          <Logo showText={false} />
          <span className="font-heading text-xl tracking-[0.08em] text-slate-100">CineMatch</span>
        </Link>

        <nav className="flex items-center gap-5 text-sm md:gap-7">
          <Link href="/" className="app-nav-link">
            Home
          </Link>
          <Link href="/recommend" className="app-nav-link">
            Recommend
          </Link>
          {status !== "loading" &&
            (session?.user ? (
              <button
                type="button"
                className="app-nav-link"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign Out
              </button>
            ) : (
              <Link href="/auth" className="app-nav-link">
                Sign In
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
