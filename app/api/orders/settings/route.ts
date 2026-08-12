import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type SettingsRow = {
  ordering_enabled: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  auto_schedule_enabled: boolean;
  open_time: string;
  close_time: string;
  pickup_minimum: number | string;
  delivery_minimum: number | string;
  prep_time_min: number;
  prep_time_max: number;
  closed_message: string;
  busy_message: string | null;
};

function hhmm(value: string) {
  return value.slice(0, 5);
}

function turkeyMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const [hour, minute] = hhmm(value).split(":").map(Number);
  return hour * 60 + minute;
}

function insideSchedule(openTime: string, closeTime: string) {
  const now = turkeyMinutesNow();
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);

  if (open === close) return true;
  if (open < close) return now >= open && now < close;

  // Gece yarısını aşan çalışma saatleri (örn. 18:00 - 02:00)
  return now >= open || now < close;
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("online_order_settings")
      .select(
        "ordering_enabled,pickup_enabled,delivery_enabled,auto_schedule_enabled,open_time,close_time,pickup_minimum,delivery_minimum,prep_time_min,prep_time_max,closed_message,busy_message"
      )
      .eq("id", 1)
      .single();

    if (error) throw error;

    const settings = data as SettingsRow;
    const scheduleOpen =
      !settings.auto_schedule_enabled ||
      insideSchedule(settings.open_time, settings.close_time);

    const acceptingOrders = settings.ordering_enabled && scheduleOpen;

    let reason: string | null = null;

    if (!settings.ordering_enabled) {
      reason = settings.closed_message || "Şu anda online sipariş alamıyoruz.";
    } else if (!scheduleOpen) {
      reason = `Online sipariş saatlerimiz ${hhmm(settings.open_time)}–${hhmm(
        settings.close_time
      )}.`;
    } else if (!settings.pickup_enabled && !settings.delivery_enabled) {
      reason = "Şu anda Gel-Al ve Paket Servis siparişi kapalı.";
    }

    return NextResponse.json({
      ok: true,
      acceptingOrders:
        acceptingOrders &&
        (settings.pickup_enabled || settings.delivery_enabled),
      reason,
      settings: {
        orderingEnabled: settings.ordering_enabled,
        pickupEnabled: settings.pickup_enabled,
        deliveryEnabled: settings.delivery_enabled,
        autoScheduleEnabled: settings.auto_schedule_enabled,
        openTime: hhmm(settings.open_time),
        closeTime: hhmm(settings.close_time),
        pickupMinimum: Number(settings.pickup_minimum || 0),
        deliveryMinimum: Number(settings.delivery_minimum || 0),
        prepTimeMin: Number(settings.prep_time_min || 0),
        prepTimeMax: Number(settings.prep_time_max || 0),
        closedMessage: settings.closed_message,
        busyMessage: settings.busy_message,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        acceptingOrders: false,
        reason: "Sipariş durumu şu anda kontrol edilemiyor.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}