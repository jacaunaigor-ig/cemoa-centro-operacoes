import { NextResponse } from "next/server";
import { getTemperaturaPayload } from "@/lib/inmet-temperatura";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getTemperaturaPayload();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
