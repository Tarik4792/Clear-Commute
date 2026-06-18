export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { route, lat, lon } = await req.json();
    if (!route || !lat || !lon) return NextResponse.json({ error: "Missing route or location" }, { status: 400 });

    const apiKey = process.env.MTA_BUS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Bus API key not configured" }, { status: 500 });

    // Step 1: Find nearest stop for this route using location
    const stopsUrl = `http://bustime.mta.info/api/where/stops-for-route/MTA NYCT_${route}.json?key=${apiKey}&includePolylines=false&version=2`;
    const stopsRes = await fetch(stopsUrl);
    
    let nearestStopId = null;
    let nearestStopName = "";
    let minDist = Infinity;

    if (stopsRes.ok) {
      const stopsData = await stopsRes.json();
      const stops = stopsData?.data?.references?.stops || [];
      
      for (const stop of stops) {
        const dist = Math.sqrt(
          Math.pow(stop.lat - lat, 2) + Math.pow(stop.lon - lon, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearestStopId = stop.id;
          nearestStopName = stop.name;
        }
      }
    }

    if (!nearestStopId) return NextResponse.json({ arrivals: [], stopName: "Stop not found" });

    // Step 2: Get live arrivals for nearest stop
    const arrivalsUrl = `http://bustime.mta.info/api/siri/stop-monitoring.json?key=${apiKey}&OperatorRef=MTA&MonitoringRef=${nearestStopId}&LineRef=MTA NYCT_${route}&MaximumStopVisits=5`;
    const arrivalsRes = await fetch(arrivalsUrl, { next: { revalidate: 30 } });
    
    if (!arrivalsRes.ok) throw new Error(`Bus API returned ${arrivalsRes.status}`);

    const data = await arrivalsRes.json();
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

    return NextResponse.json({ arrivals, stopName: nearestStopName, stopId: nearestStopId });
  } catch (err) {
    console.error("Bus error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
