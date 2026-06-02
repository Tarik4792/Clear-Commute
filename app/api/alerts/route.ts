import { NextRequest, NextResponse } from "next/server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const ALERTS_FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts";

// Only show these effect types — skip schedule reminders and info notices
const RELEVANT_EFFECTS = new Set([
  "NO_SERVICE",
  "REDUCED_SERVICE", 
  "SIGNIFICANT_DELAYS",
  "DETOUR",
  "SUSPENSION",
  "MODIFIED_SERVICE",
  "STOP_MOVED",
]);

// Skip alerts that are just schedule reminders or accessibility notices
const SKIP_KEYWORDS = [
  "schedule reminder",
  "overnight",
  "accessibili",
  "elevator",
  "escalator",
  "planned work",
  "every 12 minutes",
  "every 20 minutes",
  "runs every",
];

function isRelevant(header: string, effect: string): boolean {
  const h = header.toLowerCase();
  if (SKIP_KEYWORDS.some(k => h.includes(k))) return false;
  if (RELEVANT_EFFECTS.has(effect)) return true;
  // Also catch delays/suspensions by header text even if effect is generic
  if (h.includes("suspend") || h.includes("skip") || h.includes("no service") || 
      h.includes("delay") || h.includes("reroute") || h.includes("detour")) return true;
  return false;
}

function severityScore(effect: string): number {
  if (effect === "NO_SERVICE" || effect === "SUSPENSION") return 3;
  if (effect === "SIGNIFICANT_DELAYS" || effect === "REDUCED_SERVICE") return 2;
  return 1;
}

export async function POST(req: NextRequest) {
  try {
    const { line } = await req.json();
    if (!line) return NextResponse.json({ alerts: [] });

    const res = await fetch(ALERTS_FEED, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Feed returned ${res.status}`);

    const buffer = await res.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    const alerts: { header: string; description: string; effect: string; severity: number }[] = [];

    for (const entity of feed.entity) {
      if (!entity.alert) continue;

      const affectsLine = entity.alert.informedEntity?.some(
        (e: { routeId?: string | null }) => e.routeId?.toUpperCase() === line.toUpperCase()
      );
      if (!affectsLine) continue;

      const header = entity.alert.headerText?.translation?.[0]?.text || "";
      const description = entity.alert.descriptionText?.translation?.[0]?.text || "";
      const effect = entity.alert.effect?.toString() || "UNKNOWN_EFFECT";

      if (!header) continue;
      if (!isRelevant(header, effect)) continue;

      alerts.push({ header, description, effect, severity: severityScore(effect) });
    }

    // Sort by severity, take top 3
    alerts.sort((a, b) => b.severity - a.severity);

    return NextResponse.json({ alerts: alerts.slice(0, 3) });
  } catch (err) {
    console.error("Alerts error:", err);
    return NextResponse.json({ alerts: [], error: "Could not fetch alerts" });
  }
}
