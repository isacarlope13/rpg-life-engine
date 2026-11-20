"use client";

import { useEffect } from "react";
import { LandingPage } from "@/components/landing-page";

export default function Page() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.includes("access_token=") && (hash.includes("type=invite") || hash.includes("type=recovery"))) {
      window.location.replace(`/login?mode=reset${hash}`);
    }
  }, []);

  return <LandingPage />;
}
