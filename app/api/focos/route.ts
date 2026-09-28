import { NextResponse } from "next/server";
import { getFocosReferencia } from "@/lib/focos-referencia";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getFocosReferencia();
  return NextResponse.json(payload);
}
