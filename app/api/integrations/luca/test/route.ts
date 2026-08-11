import { NextResponse } from "next/server";

type LucaCompany = {
  SchemaName?: string;
  FirmaAdi?: string;
  IdFirma?: number;
  IdAnaFirma?: number;
  UserHasRole?: boolean;
  IdFaturaPaket?: number;
  FaturaOzelNot?: string;
};

type LucaLoginResponse = {
  IdKullanıcı?: number;
  Tcno?: string;
  Adi?: string;
  Soyadi?: string;
  IdPersonelSicil?: number;
  Token?: string;
  CompanyList?: LucaCompany[];
  ExpiresOn?: string;
  Result?: number | string;
  ErrorMessage?: string;
};

export async function GET() {
  try {
    const baseUrl = process.env.LUCA_EFATURA_BASE_URL;
    const identificationNumber =
      process.env.LUCA_EFATURA_IDENTIFICATION_NUMBER;
    const password = process.env.LUCA_EFATURA_PASSWORD;

    if (!baseUrl || !identificationNumber || !password) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "LUCA_EFATURA_BASE_URL, LUCA_EFATURA_IDENTIFICATION_NUMBER veya LUCA_EFATURA_PASSWORD eksik.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/Account/Login`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          IdentificationNumber: identificationNumber,
          Password: password,
        }),
        cache: "no-store",
      }
    );

    const raw = await response.text();

    let data: LucaLoginResponse | null = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          status: response.status,
          error: "LUCA JSON olmayan bir cevap döndürdü.",
          responsePreview: raw.slice(0, 500),
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
  return NextResponse.json(
    {
      ok: false,
      status: response.status,
      result: data?.Result ?? null,
      errorMessage: data?.ErrorMessage ?? null,
      response: data,
    },
    { status: response.status }
  );
}

    if (!data?.Token) {
      return NextResponse.json(
        {
          ok: false,
          authenticated: false,
          result: data?.Result ?? null,
          errorMessage:
            data?.ErrorMessage ||
            "LUCA login başarılı görünmedi; token dönmedi.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      expiresOn: data.ExpiresOn ?? null,

      user: {
        name: [data.Adi, data.Soyadi]
          .filter(Boolean)
          .join(" "),
      },

      companies: (data.CompanyList ?? []).map((company) => ({
        idFirma: company.IdFirma ?? null,
        firmaAdi: company.FirmaAdi ?? null,
        schemaName: company.SchemaName ?? null,
        userHasRole: company.UserHasRole ?? null,
        idFaturaPaket: company.IdFaturaPaket ?? null,
      })),

      message: "TÜRMOB LUCA e-Fatura bağlantısı başarılı.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "LUCA bağlantı testi başarısız.",
      },
      { status: 500 }
    );
  }
}