export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export interface InstallmentOption {
  installments: number;
  installment_amount: number;
  total_amount: number;
  labels: string[];
}

export async function GET(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get("amount") ?? 0);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "amount requerido" }, { status: 400 });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.mercadopago.com/v1/payment_methods/installments?amount=${amount}&site_id=MLA`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) throw new Error(`MP API error ${res.status}`);
    const data: any[] = await res.json();

    // Filter credit cards only, pick the first issuer's installment list
    const credit = data.filter((pm: any) => pm.payment_type_id === "credit_card");
    const options: InstallmentOption[] = [];

    // Merge all installment options across issuers, keep highest total_amount per n
    const map = new Map<number, InstallmentOption>();
    for (const pm of credit) {
      for (const issuer of pm.payer_costs ?? []) {
        const n: number = issuer.installments;
        const existing = map.get(n);
        if (!existing || issuer.total_amount < (existing?.total_amount ?? Infinity)) {
          map.set(n, {
            installments: n,
            installment_amount: issuer.installment_amount,
            total_amount: issuer.total_amount,
            labels: issuer.labels ?? [],
          });
        }
      }
    }
    map.forEach((v) => options.push(v));
    options.sort((a, b) => a.installments - b.installments);

    return NextResponse.json({ options, amount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
