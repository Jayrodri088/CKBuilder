"use client";

import { useEffect, useState } from "react";

export function Countdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, expiresAt - now);
  const expired = left === 0;
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);

  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        color: expired ? "var(--ember)" : "var(--mute)",
      }}
    >
      {expired ? "expired" : `${m}:${s.toString().padStart(2, "0")} left`}
    </span>
  );
}
