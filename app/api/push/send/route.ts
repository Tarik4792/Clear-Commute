export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const DB_PATH = join(process.cwd(), "subscriptions.json");

export async function POST(req: NextRequest) {
  try {
    const { title, body, icon, badge } = await req.json();

    if (!existsSync(DB_PATH)) {
      return NextResponse.json({ sent: 0 });
    }

    const subs = JSON.parse(readFileSync(DB_PATH, "utf-8"));
    let sent = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({ title, body, icon: icon || "/icons/icon.svg", badge })
        );
        sent++;
      } catch (err) {
        console.error("Push failed for subscription:", err);
      }
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Send error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
