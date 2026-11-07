"use client";

import React from "react";
import { useParams } from "next/navigation";
import { RPGLifeEngineDashboard } from "@/components/rpg-dashboard";
import type { SkillDomain } from "@/types/rpg";

export default function DedicatedSkillPage() {
  const params = useParams();
  const rawDomain = Array.isArray(params?.domain)
    ? params.domain[0]
    : params?.domain;

  const validDomains: SkillDomain[] = [
    "rubik",
    "reading",
    "knitting",
    "study",
    "work",
    "gaming",
    "sports",
    "general",
  ];

  const domain: SkillDomain =
    rawDomain && validDomains.includes(rawDomain as SkillDomain)
      ? (rawDomain as SkillDomain)
      : "rubik";

  return <RPGLifeEngineDashboard dedicatedSkillDomain={domain} />;
}
