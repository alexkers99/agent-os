// Activity log — returns .paul/history.log as an array of lines (newest first).
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const log = await fs.readFile(path.resolve(process.cwd(), ".paul", "history.log"), "utf8");
    const lines = log
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .reverse();
    return NextResponse.json({ lines });
  } catch {
    return NextResponse.json({ lines: [] });
  }
}
