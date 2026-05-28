"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { LogIn, LogOut, Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { fetchMe, loginUrl, logout, type Me } from "@/lib/sync/client";

export function AccountSection() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMe().then(setMe);
  }, []);

  async function onLogout() {
    setBusy(true);
    await logout();
    const fresh = await fetchMe();
    setMe(fresh);
    setBusy(false);
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
        Account &amp; sync
      </h3>

      {!me ? (
        <div className="p-3 rounded-xl bg-[var(--surface-2)] flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 size={14} className="animate-spin" /> Checking…
        </div>
      ) : !me.configured ? (
        <div className="p-3 rounded-xl bg-[var(--surface-2)] text-sm text-[var(--muted)]">
          Google sign-in isn&apos;t configured on the server yet. Add
          GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel to enable
          cross-device sync.
        </div>
      ) : me.loggedIn ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)]">
            <div className="flex items-center gap-3 min-w-0">
              {me.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.picture}
                  alt=""
                  className="w-9 h-9 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                  <Cloud size={16} className="text-[var(--accent)]" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {me.name ?? me.email}
                </p>
                <p className="text-xs text-[var(--success)] flex items-center gap-1">
                  <Cloud size={11} /> Synced across devices
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--surface)] hover:bg-[var(--border)] transition flex items-center gap-1.5 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <LogOut size={12} />
              )}
              Sign out
            </button>
          </div>
          <p className="text-xs text-[var(--muted)] px-1 flex items-center gap-1.5">
            <RefreshCw size={11} /> Sign in with this same Google account on
            your other devices to keep everything in sync.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]">
            <CloudOff size={16} className="text-[var(--muted)]" />
            <div className="flex-1">
              <p className="text-sm">Not signed in</p>
              <p className="text-xs text-[var(--muted)]">
                Your data lives only on this device.
              </p>
            </div>
          </div>
          <motion.a
            whileTap={{ scale: 0.97 }}
            href={loginUrl()}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] text-white text-sm font-medium shadow-lg shadow-[var(--accent)]/30"
          >
            <LogIn size={14} /> Sign in with Google to sync devices
          </motion.a>
        </div>
      )}
    </section>
  );
}
