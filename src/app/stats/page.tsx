"use client";

import { useEffect, useState } from "react";
import { StatsView } from "@/components/StatsView";

export default function StatsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <StatsView />;
}
