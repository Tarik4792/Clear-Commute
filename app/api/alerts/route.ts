import { NextRequest, NextResponse } from "next/server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const ALERTS_FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts";

export async function POST(req: NextRequest) {
  try {
    const { line } = await req.json();
    if (!line) return NextResponse.json({ alerts: [] });
    const res = await fetch(ALERTS_FEED, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    const buffer = await res.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
    const alerts: { header: string; description: string; effect: string }[] = [];
    for (const entity of feed.entity) {
      if (!entity.alert) continue;
      const affects = entity.alert.informedEntity?.some((e: { routeId?: string }) => e.routeId?.toUpperCase() === line.toUpperCase());
      if (!affects) continue;
      const header = entity.alert.headerText?.translation?.[0]?.text || "";
      const description = entity.alert.descriptionText?.translation?.[0]?.text || "";
      const effect = entity.alert.effect?.toString() || "";
      if (header) alerts.push({ header, description, effect });
    }
    return NextResponse.json({ alerts: alerts.slice(0, 5) });
  } catch (err) {
    console.error("Alerts error:", err);
    return NextResponse.json({ alerts: [] });
  }
}
