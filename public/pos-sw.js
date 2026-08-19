/* Leman's Deli POS background push service worker */

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "🚨 YENİ SİPARİŞ",
      body: event.data ? event.data.text() : "Yeni sipariş geldi.",
    };
  }

  const title = payload.title || "🚨 YENİ SİPARİŞ";
  const options = {
    body: payload.body || "Yeni sipariş geldi.",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: payload.tag || `lemans-pos-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: payload.url || "/pos",
      orderId: payload.orderId || null,
    },
    actions: [
      {
        action: "open-pos",
        title: "POS'u Aç",
      },
    ],
  };

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (clients) => {
        const visiblePosClient = clients.find((client) => {
          try {
            const url = new URL(client.url);
            return (
              url.pathname.startsWith("/pos") &&
              client.visibilityState === "visible"
            );
          } catch {
            return false;
          }
        });

        if (visiblePosClient) {
          visiblePosClient.postMessage({
            type: "LEMANS_POS_PUSH",
            payload,
          });
          return;
        }

        await self.registration.showNotification(title, options);
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || "/pos";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (clients) => {
        for (const client of clients) {
          try {
            const url = new URL(client.url);

            if (url.pathname.startsWith("/pos")) {
              if ("focus" in client) {
                await client.focus();
              }

              if ("navigate" in client && url.pathname !== targetUrl) {
                await client.navigate(targetUrl);
              }

              return;
            }
          } catch {}
        }

        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl);
        }
      })
  );
});
