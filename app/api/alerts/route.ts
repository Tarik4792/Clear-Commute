import { NextRequest, NextResponse } from "next/server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const ALERTS_FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts";

const SKIP_KEYWORDS = [
  "schedule reminder", "overnight", "accessibili", "elevator",
  "escalator", "planned work", "runs every", "every 12", "every 20",
  "every 15", "every 10", "board from",
];

function isRelevant(header: string): boolean {
  const h = header.toLowerCase();
  if (SKIP_KEYWORDS.some(k => h.includes(k))) return false;
  return h.includes("suspend") || h.includes("skip") || h.includes("no service") ||
    h.includes("delay") || h.includes("reroute") || h.includes("detour") ||
    h.includes("service change") || h.includes("modified") || h.includes("reduced");
}

function severityScore(effect: string): number {
  if (effect.includes("NO_SERVICE") || effect.includes("SUSPENSION")) return 3;
  if (effect.includes("DELAY") || effect.includes("REDUCED")) return 2;
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

    const seen = new Set<string>();
    const alerts: { header: string; effect: string; severity: number }[] = [];

    for (const entity of feed.entity) {
      if (!entity.alert) continue;

      const affectsLine = entity.alert.informedEntity?.some(
        (e: { routeId?: string | null }) => e.routeId?.toUpperCase() === line.toUpperCase()
      );
      if (!affectsLine) continue;

      const header = entity.alert.headerText?.translation?.[0]?.text || "";
      const effect = entity.alert.effect?.toString() || "";

      if (!header || seen.has(header) || !isRelevant(header)) continue;

      seen.add(header);
      alerts.push({ header, effect, severity: severityScore(effect) });
    }

    alerts.sort((a, b) => b.severity - a.severity);
    return NextResponse.json({ alerts: alerts.slice(0, 3) });
  } catch (err) {
    console.error("Alerts error:", err);
    return NextResponse.json({ alerts: [] });
  }
}
