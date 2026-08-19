import * as webpush from "web-push";
import { supabaseAdmin } from "./supabaseAdmin";

type PosPushPayload = {
  title: string;
  body: string;
  orderId?: number | null;
  tag?: string;
  url?: string;
};

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return;

  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:info@lemansdeli.com";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Web Push için NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY eksik."
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendPosPush(payload: PosPushPayload) {
  configureVapid();

  const { data: subscriptions, error } = await supabaseAdmin
    .from("pos_push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("active", true);

  if (error) throw error;
  if (!subscriptions?.length) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth,
            },
          },
          JSON.stringify({
            ...payload,
            url: payload.url || "/pos",
          }),
          {
            TTL: 60 * 10,
            urgency: "high",
          }
        );

        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from("pos_push_subscriptions")
            .delete()
            .eq("id", row.id);

          removed += 1;
          return;
        }

        console.error(
          "POS PUSH SEND ERROR:",
          row.id,
          error
        );
      }
    })
  );

  return { sent, removed };
}
