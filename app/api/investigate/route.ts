import { NextResponse } from "next/server";
import { z } from "zod";
import { investigate } from "@/lib/osint/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  query: z.string().trim().min(2).max(200),
  maxDepth: z.number().int().min(0).max(3).default(2),
});

async function run(query: string, maxDepth: number) {
  const result = await investigate(query, maxDepth, 40);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const body = schema.parse({
      query: url.searchParams.get("q") ?? "",
      maxDepth: Number(url.searchParams.get("depth") ?? 1),
    });
    return await run(body.query, body.maxDepth);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    return await run(body.query, body.maxDepth);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
