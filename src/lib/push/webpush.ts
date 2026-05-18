import "server-only";
import webpush from "web-push";

let configured = false;

export function getWebPush() {
  if (!configured) {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:noreply@example.com";
    if (!pub || !priv) {
      throw new Error(
        "VAPID keys missing. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env.local."
      );
    }
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
  return webpush;
}
