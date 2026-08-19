import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type SubscriptionBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

async function getAuthorizedStaff(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7);

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    return null;
  }

  const { data: staff, error: staffError } = await supabaseAdmin
    .from("staff_profiles")
    .select("role,active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (
    staffError ||
    !staff?.active ||
    !["cashier", "kitchen", "admin", "owner"].includes(
      String(staff.role)
    )
  ) {
    return null;
  }

  return authData.user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthorizedStaff(request);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Yetkisiz." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SubscriptionBody;

    const endpoint =
      typeof body.endpoint === "string"
        ? body.endpoint.trim()
        : "";
    const p256dh =
      typeof body.keys?.p256dh === "string"
        ? body.keys.p256dh.trim()
        : "";
    const auth =
      typeof body.keys?.auth === "string"
        ? body.keys.auth.trim()
        : "";

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz push subscription." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("pos_push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent:
            request.headers.get("user-agent")?.slice(0, 500) ||
            null,
          active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POS PUSH SUBSCRIBE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Push kaydı oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthorizedStaff(request);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Yetkisiz." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      endpoint?: string;
    };

    const endpoint =
      typeof body.endpoint === "string"
        ? body.endpoint.trim()
        : "";

    if (!endpoint) {
      return NextResponse.json(
        { ok: false, error: "Endpoint gerekli." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("pos_push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POS PUSH DELETE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Push kaydı silinemedi.",
      },
      { status: 500 }
    );
  }
}
