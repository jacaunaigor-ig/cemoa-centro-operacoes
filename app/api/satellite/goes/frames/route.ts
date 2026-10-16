import { NextResponse } from "next/server";
import { listRecentGoesFrames } from "@/lib/goes-satellite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const frames = await listRecentGoesFrames(6);
    return NextResponse.json({
      generatedAt: Date.now(),
      frames: frames.map((f) => ({
        stamp: f.stamp,
        imageAt: f.imageAt,
        imageUrl: `/api/satellite/goes/image?at=${f.stamp}`,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      {
        generatedAt: Date.now(),
        frames: [],
        error: err instanceof Error ? err.message : "Falha ao listar cenas GOES.",
      },
      { status: 200 },
    );
  }
}
