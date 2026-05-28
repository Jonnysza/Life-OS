"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Check, Copy, RefreshCcw } from "lucide-react";
import { getSessionId } from "@/lib/session";
import { sendTestPush } from "@/lib/push/client";

type OwnerDebug = {
  ok: boolean;
  redis: boolean;
  ownerId: string;
  loggedIn: boolean;
  email: string | null;
  error?: string;
};

export function DiagnosticsSection() {
  const [debug, setDebug] = useState<OwnerDebug | null>(null);
  const [busy, setBusy] = useState<null | "refresh" | "copy" | "check">(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy("refresh");
    setMessage("");
    try {
      const res = await fetch(
        `/api/debug/owner?sessionId=${encodeURIComponent(getSessionId())}`,
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => ({}))) as OwnerDebug;
      if (!res.ok) throw new Error((data as any)?.error ?? "Debug failed.");
      setDebug(data);
    } catch (e) {
      setDebug(null);
      setMessage(e instanceof Error ? e.message : "Debug failed.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function copyOwner() {
    if (!debug?.ownerId) return;
    setBusy("copy");
    await navigator.clipboard.writeText(debug.ownerId);
    setMessage("Owner id copied.");
    setTimeout(() => setBusy(null), 700);
  }

  async function checkNow() {
    setBusy("check");
    setMessage("");
    try {
      window.dispatchEvent(new Event("life-os:force-schedule-sync"));
      await new Promise((r) => setTimeout(r, 900));
      const res = await sendTestPush({
        title: "Life OS diagnostics",
        body: "If this arrived, push delivery works on this device.",
      });
      if (res?.error) throw new Error(res.error);
      setMessage("Sent a diagnostics push. If you got it, delivery is working.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Push check failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Diagnostics
        </h3>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={refresh}
          disabled={busy !== null}
          className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)] text-xs flex items-center gap-1.5 disabled:opacity-45"
        >
          <RefreshCcw size={12} />
          Refresh
        </motion.button>
      </div>

      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 space-y-2">
        {debug ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  debug.redis ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-[var(--danger)]/15 text-[var(--danger)]"
                }`}
              >
                {debug.redis ? "redis ok" : "redis missing"}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  debug.loggedIn ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-[var(--muted)]/10 text-[var(--muted)]"
                }`}
              >
                {debug.loggedIn ? "signed in" : "not signed in"}
              </span>
              {debug.email && (
                <span className="text-[11px] text-[var(--muted)] truncate">
                  {debug.email}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  Owner id
                </p>
                <p className="text-xs font-mono truncate">{debug.ownerId}</p>
              </div>
              <button
                onClick={copyOwner}
                className="px-3 py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--border)] text-xs flex items-center gap-1.5"
              >
                {busy === "copy" ? <Check size={12} /> : <Copy size={12} />}
                Copy
              </button>
            </div>

            <button
              onClick={checkNow}
              disabled={busy !== null}
              className="w-full px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-45 flex items-center justify-center gap-2"
            >
              <AlertTriangle size={12} />
              Force re-arm + send push check
            </button>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}

        {message && <p className="text-[11px] text-[var(--muted)]">{message}</p>}
      </div>
    </section>
  );
}

