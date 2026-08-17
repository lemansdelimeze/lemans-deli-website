import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type StatusEmailBody = {
  orderId?: number;
  stage?: "preparing" | "ready";
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendStatusEmail(args: {
  to: string;
  customerName: string;
  orderCode: string;
  orderType: string | null;
  stage: "preparing" | "ready";
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY tanımlı değil.");
  }

  const preparing = args.stage === "preparing";

  const subject = preparing
    ? `Siparişiniz hazırlanıyor · ${args.orderCode}`
    : `Siparişiniz hazır · ${args.orderCode}`;

  const title = preparing
    ? "Siparişiniz hazırlanıyor"
    : "Siparişiniz hazır!";

  const isPickup = args.orderType === "Gel-Al";

const message = preparing
  ? "Siparişinizi hazırlamaya başladık. Hazır olduğunda size tekrar haber vereceğiz."
  : isPickup
    ? "Siparişiniz hazırlandı. Dilediğiniz zaman Leman’s Deli’den teslim alabilirsiniz."
    : "Siparişiniz hazırlandı ve teslimat için yola çıkmaya hazır. Kısa süre içinde size ulaştıracağız.";

  const html = `
    <div style="
      margin:0;
      padding:32px 16px;
      background:#f5efe7;
      font-family:Arial,Helvetica,sans-serif;
      color:#2a1711;
    ">
      <div style="
        max-width:560px;
        margin:0 auto;
        background:#fffaf4;
        border:1px solid #ead8ce;
        border-radius:24px;
        overflow:hidden;
      ">

        <div style="padding:32px 28px 18px;text-align:center;">
          <img
            src="https://lemansdeli.com/logo-horizontal.png"
            alt="Leman's Deli"
            width="250"
            style="
              display:block;
              width:250px;
              max-width:82%;
              height:auto;
              margin:0 auto;
            "
          />
        </div>

        <div style="padding:10px 30px 36px;text-align:center;">
          <div style="font-size:42px;margin-bottom:12px;">
            ${preparing ? "👩‍🍳" : "✓"}
          </div>

          <h1 style="
            margin:0 0 18px;
            font-family:'Courier New',Courier,monospace;
            font-size:28px;
            color:#922800;
          ">
            ${title}
          </h1>

          <p style="
            margin:0 0 10px;
            font-size:16px;
            line-height:1.6;
          ">
            Merhaba ${escapeHtml(args.customerName)},
          </p>

          <p style="
            margin:0 auto;
            max-width:430px;
            font-size:15px;
            line-height:1.7;
            color:#6b5a51;
          ">
            ${message}
          </p>

          <div style="
            margin:24px auto 0;
            max-width:360px;
            padding:16px;
            background:#f5efe7;
            border-radius:16px;
          ">
            <strong>Sipariş No:</strong>
            ${escapeHtml(args.orderCode)}
          </div>
        </div>

        <div style="
          border-top:1px solid #ead8ce;
          padding:18px 24px;
          text-align:center;
          font-size:12px;
          line-height:1.6;
          color:#9a8478;
        ">
          Leman's Deli · Kaş<br />
          +90 530 700 57 04
        </div>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Leman's Deli <no-reply@lemansdeli.com>",
      to: [args.to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend: ${response.status} ${detail}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StatusEmailBody;

    const orderId = Number(body.orderId);
    const stage = body.stage;

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0 ||
      (stage !== "preparing" && stage !== "ready")
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz istek." },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("pos_orders")
      .select(
  "id,receipt_number,customer_name,customer_email,source,order_type"
)
      .eq("id", orderId)
      .single();

    if (error) throw error;

    // Şimdilik yalnızca bizim web siparişlerine mail gönderiyoruz.
    if (order.source !== "web") {
      return NextResponse.json({
        ok: true,
        skipped: true,
      });
    }

    if (!order.customer_email) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "customer_email yok",
      });
    }

    await sendStatusEmail({
  to: order.customer_email,
  customerName: order.customer_name || "Müşteri",
  orderCode: order.receipt_number || `#${order.id}`,
  orderType: order.order_type,
  stage,
});

    return NextResponse.json({
      ok: true,
      sent: true,
    });
  } catch (error) {
    console.error("ORDER STATUS EMAIL ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Durum e-postası gönderilemedi.",
      },
      { status: 500 }
    );
  }
}