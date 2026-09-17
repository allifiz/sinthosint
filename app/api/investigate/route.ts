import { NextResponse } from "next/server";
import { z } from "zod";
import { investigate } from "@/lib/osint/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  query: z.string().trim().min(2).max(200),
  maxDepth: z.number().int().min(0).max(3).default(2),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const result = await investigate(body.query, body.maxDepth, 40);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
