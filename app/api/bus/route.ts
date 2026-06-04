import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { route, stop } = await req.json();
    if (!route) return NextResponse.json({ error: "Missing route" }, { status: 400 });

    const apiKey = process.env.MTA_BUS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Bus API key not configured" }, { status: 500 });

    const url = `http://bustime.mta.info/api/siri/stop-monitoring.json?key=${apiKey}&OperatorRef=MTA&MonitoringRef=${stop}&LineRef=MTA NYCT_${route}&MaximumStopVisits=5`;

    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`Bus API returned ${res.status}`);

    const data = await res.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

    const arrivals = visits.map((visit: Record<string, unknown>) => {
      const journey = visit.MonitoredVehicleJourney as Record<string, unknown>;
      const call = journey?.MonitoredCall as Record<string, unknown>;
      const extensions = call?.Extensions as Record<string, unknown>;
      const distances = extensions?.Distances as Record<string, unknown>;
      const expectedArrival = call?.ExpectedArrivalTime as string;
      const presentable = distances?.PresentableDistance as string;
      const stopsAway = distances?.StopsFromCall as number;
      let minutes = null;
      if (expectedArrival) {
        const diff = new Date(expectedArrival).getTime() - Date.now();
        minutes = Math.max(0, Math.round(diff / 60000));
      }
      return {
        route: journey?.PublishedLineName as string || route,
        destination: journey?.DestinationName as string || "",
        minutes, stopsAway,
        presentable: presentable || (minutes !== null ? `${minutes} min` : "Unknown"),
      };
    }).filter((a: { minutes: number | null }) => a.minutes === null || a.minutes <= 60);

    return NextResponse.json({ arrivals, stop });
  } catch (err) {
    console.error("Bus error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
