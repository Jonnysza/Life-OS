"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bell, BellOff, Loader2, AlertTriangle, Send } from "lucide-react";
import {
  pushSupported,
  registerServiceWorker,
  getCurrentSubscription,
  ensurePushSubscriptionRegistered,
  subscribePush,
  unsubscribePush,
  sendTestPush,
} from "@/lib/push/client";

export function NotificationsSection() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [armed, setArmed] = useState<number | null>(null);

  useEffect(() => {
    if (!pushSupported()) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    (async () => {
      try {
        await registerServiceWorker();
        const sub = await getCurrentSubscription();
        setSubscribed(!!sub);
        if (sub) await ensurePushSubscriptionRegistered();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Service worker error");
      }
    })();
  }, []);

  useEffect(() => {
    function onSync(event: Event) {
      const detail = (event as CustomEvent<{ total?: number; error?: string }>).detail;
      if (typeof detail?.total === "number") setArmed(detail.total);
    }
    window.addEventListener("life-os:schedule-sync", onSync);
    return () => window.removeEventListener("life-os:schedule-sync", onSync);
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Permission denied. Enable notifications in your browser/OS settings.");
        setBusy(false);
        return;
      }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        setError("VAPID public key missing. Check .env.local.");
        setBusy(false);
        return;
      }
      await subscribePush(vapid);
      setSubscribed(true);
      setInfo("Notifications enabled. Timed tasks will be armed automatically.");
      window.dispatchEvent(new Event("life-os:force-schedule-sync"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to enable");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await unsubscribePush();
      setSubscribed(false);
      setInfo("Notifications disabled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const registered = await ensurePushSubscriptionRegistered();
      window.dispatchEvent(new Event("life-os:force-schedule-sync"));
      await new Promise((resolve) => setTimeout(resolve, 900));
      if (!registered) {
        setError("This device is not subscribed anymore. Disable and enable notifications again.");
        return;
      }
      const res = await sendTestPush({
        title: "Life OS notification check",
        body: "If this arrived, this device can receive the screaming checklist reminders.",
      });
      if (res.error) setError(res.error);
      else setInfo(`Check sent to ${res.sent} device${res.sent === 1 ? "" : "s"}. Timed tasks were re-armed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
        Push notifications
      </h3>

      {!supported ? (
        <div className="p-3 rounded-xl bg-[var(--surface-2)] text-sm text-[var(--muted)]">
          This browser doesn&apos;t support push notifications.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)]">
            <div className="flex items-center gap-3">
              {subscribed ? (
                <Bell size={16} className="text-[var(--success)]" />
              ) : (
                <BellOff size={16} className="text-[var(--muted)]" />
              )}
              <div>
                <p className="text-sm">
                  {subscribed ? "Notifications on" : "Notifications off"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {subscribed
                    ? armed === null
                      ? "This device will receive pushes for tasks with a time."
                      : `${armed} upcoming timed reminder${armed === 1 ? "" : "s"} armed.`
                    : permission === "denied"
                      ? "Permission denied — unblock in browser settings."
                      : "Enable to receive reminders on this device."}
                </p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={subscribed ? disable : enable}
              disabled={busy || permission === "denied"}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-40 ${
                subscribed
                  ? "bg-[var(--surface)] hover:bg-[var(--border)]"
                  : "bg-[var(--accent)] text-white hover:opacity-90"
              }`}
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : subscribed ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </motion.button>
          </div>

          {subscribed && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={test}
              disabled={busy}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] text-sm transition disabled:opacity-40"
            >
              <Send size={13} /> Run notification check
            </motion.button>
          )}

          <p className="text-[11px] text-[var(--muted)] px-1 leading-relaxed">
            Reminder rule: a task must have a time. Open Today -&gt; List and set
            a time, or switch to Schedule and drop a task onto the timeline.
          </p>

          {info && (
            <p className="text-xs text-[var(--success)] px-1">{info}</p>
          )}
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30">
              <AlertTriangle size={12} className="text-[var(--danger)] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[var(--danger)]">{error}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
