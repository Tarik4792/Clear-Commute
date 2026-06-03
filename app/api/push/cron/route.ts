import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getCurrentTimeET(): { hour: number; minute: number; day: string } {
  const now = new Date();
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric", minute: "numeric", weekday: "long", hour12: false,
  }).formatToParts(now);
  const hour = parseInt(et.find(p => p.type === "hour")?.value || "0");
  const minute = parseInt(et.find(p => p.type === "minute")?.value || "0");
  const day = et.find(p => p.type === "weekday")?.value || "";
  return { hour, minute, day };
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { hour, minute, day } = getCurrentTimeET();
    const currentMinutes = hour * 60 + minute;

    const { data: commutes } = await supabase
      .from("saved_commutes")
      .select("*")
      .eq("notify_departure", true);

    if (!commutes || commutes.length === 0) {
      return NextResponse.json({ checked: 0, notified: 0 });
    }

    let notified = 0;

    for (const commute of commutes) {
      const notifyDays = commute.notify_days || ["Monday","Tuesday","Wednesday","Thursday","Friday"];
      if (!notifyDays.includes(day)) continue;

      const departMinutes = timeToMinutes(commute.depart_time);
      const minutesUntil = departMinutes - currentMinutes;

      if (minutesUntil !== 30 && minutesUntil !== 10) continue;

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", commute.user_id);

      if (!subs || subs.length === 0) continue;

      const title = minutesUntil === 30
        ? `🚇 Leave in 30 min — ${commute.line} train`
        : `⏰ Leave now — ${commute.line} train in 10 min`;

      const body = minutesUntil === 30
        ? `Your ${commute.line} from ${commute.origin} departs at ${commute.depart_time}. Check crowd levels.`
        : `Head to the station now. ${commute.line} from ${commute.origin} → ${commute.destination}.`;

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, icon: "/icons/icon.svg" })
          );
          notified++;
        } catch (err) {
          console.error("Push failed:", err);
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    return NextResponse.json({ checked: commutes.length, notified });
  } catch (err) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
