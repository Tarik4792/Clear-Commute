import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DB_PATH = join(process.cwd(), "subscriptions.json");

function readSubs(): Record<string, unknown>[] {
  if (!existsSync(DB_PATH)) return [];
  return JSON.parse(readFileSync(DB_PATH, "utf-8"));
}

function writeSubs(subs: Record<string, unknown>[]) {
  writeFileSync(DB_PATH, JSON.stringify(subs, null, 2));
}

export async function POST(req: NextRequest) {
  try {
    const { subscription, profile } = await req.json();
    if (!subscription) return NextResponse.json({ error: "No subscription" }, { status: 400 });

    const subs = readSubs();
    const existing = subs.findIndex((s: Record<string, unknown>) => 
      (s.subscription as { endpoint: string }).endpoint === subscription.endpoint
    );

    if (existing >= 0) {
      subs[existing] = { subscription, profile, updatedAt: new Date().toISOString() };
    } else {
      subs.push({ subscription, profile, createdAt: new Date().toISOString() });
    }

    writeSubs(subs);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
