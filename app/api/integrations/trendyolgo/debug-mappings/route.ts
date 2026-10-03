import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireIntegrationUser } from "../../../../../lib/integrations/requireUser";

export async function GET(request: NextRequest) {
  try {
    if (!(await requireIntegrationUser(request))) {
      return NextResponse.json({ ok: false, error: "Personel oturumu bulunamadı." }, { status: 401 });
    }
    const { data, error, count } = await supabaseAdmin
      .from("integration_product_mappings")
      .select(
        "id,channel,menu_item_id,external_product_id,external_name,active",
        { count: "exact" }
      )
      .eq("channel", "trendyol")
      .eq("active", true)
      .limit(5);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      count,
      sample: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Mapping kontrolü başarısız.",
      },
      { status: 500 }
    );
  }
}
