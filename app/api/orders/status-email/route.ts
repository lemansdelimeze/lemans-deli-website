import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type StatusEmailBody = {
  orderId?: number;
  stage?: "preparing" | "ready" | "cancelled";
  cancelReason?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

async function sendStatusEmail(args: {
  to: string;
  customerName: string;
  orderCode: string;
  orderType: string | null;
  stage: "preparing" | "ready" | "cancelled";
  cancelReason?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY tanımlı değil.");
  }

  const isPickup =
    args.orderType === "Gel-Al" ||
    args.orderType === "pickup" ||
    args.orderType === "Pickup";

  let subject = "";
  let title = "";
  let icon = "";
  let message = "";

  if (args.stage === "preparing") {
    subject = `Siparişiniz hazırlanıyor · ${args.orderCode}`;
    title = "Siparişiniz hazırlanıyor";
    icon = "👩‍🍳";
    message =
      "Siparişinizi hazırlamaya başladık. Hazır olduğunda size tekrar haber vereceğiz.";
  } else if (args.stage === "ready") {
    subject = `Siparişiniz hazır · ${args.orderCode}`;
    title = "Siparişiniz hazır!";
    icon = "✓";
    message = isPickup
      ? "Siparişiniz hazırlandı. Dilediğiniz zaman Leman’s Deli’den teslim alabilirsiniz."
      : "Siparişiniz hazırlandı ve teslimat için yola çıkmaya hazır. Kısa süre içinde size ulaştıracağız.";
  } else {
    subject = `Siparişiniz iptal edildi · ${args.orderCode}`;
    title = "Siparişiniz iptal edildi";
    icon = "×";
    message =
      "Siparişiniz iptal edilmiştir. Bu sipariş artık hazırlanmayacaktır.";
  }

  const reason =
    args.stage === "cancelled" && args.cancelReason
      ? `
        <div style="
          margin:22px auto 0;
          max-width:420px;
          padding:16px 18px;
          background:#fff0ed;
          border:1px solid #efc7bd;
          border-radius:16px;
          text-align:left;
        ">
          <div style="font-size:12px;font-weight:700;color:#922800;margin-bottom:6px;">
            İptal nedeni
          </div>
          <div style="font-size:14px;line-height:1.6;color:#5d4037;">
            ${escapeHtml(args.cancelReason)}
          </div>
        </div>
      `
      : "";

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
          <div style="
            width:58px;
            height:58px;
            margin:0 auto 14px;
            border-radius:50%;
            background:${args.stage === "cancelled" ? "#922800" : "#f5efe7"};
            color:${args.stage === "cancelled" ? "#ffffff" : "#922800"};
            line-height:58px;
            font-size:34px;
            font-weight:700;
          ">
            ${icon}
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

          ${reason}

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

          ${
            args.stage === "cancelled"
              ? `
                <p style="
                  margin:20px auto 0;
                  max-width:430px;
                  font-size:13px;
                  line-height:1.6;
                  color:#8a756a;
                ">
                  Siparişinizle ilgili bir sorunuz varsa bize telefon veya WhatsApp üzerinden ulaşabilirsiniz.
                </p>
              `
              : ""
          }
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
      "User-Agent": "lemans-deli-order-api/1.0",
      "Idempotency-Key": `order-status-${args.orderCode}-${args.stage}`,
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
    const submittedCancelReason = cleanText(body.cancelReason, 500);

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0 ||
      (stage !== "preparing" &&
        stage !== "ready" &&
        stage !== "cancelled")
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz istek." },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabaseAdmin
      .from("pos_orders")
      .select(
        "id,receipt_number,customer_name,customer_email,source,order_type,cancel_reason"
      )
      .eq("id", orderId)
      .single();

    if (error) throw error;

    if (order.source !== "web") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "web siparişi değil",
      });
    }

    if (!order.customer_email) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "customer_email yok",
      });
    }

    const cancelReason =
      stage === "cancelled"
        ? submittedCancelReason ||
          cleanText(order.cancel_reason, 500) ||
          null
        : null;

    await sendStatusEmail({
      to: order.customer_email,
      customerName: order.customer_name || "Müşteri",
      orderCode: order.receipt_number || `#${order.id}`,
      orderType: order.order_type,
      stage,
      cancelReason,
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