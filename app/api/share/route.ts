import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { line, origin, dest, time, day, crowdScore, crowdLabel, aiSummary, departureSuggestions } = await req.json();

    // Generate a simple share ID from the data
    const shareData = {
      line, origin, dest, time, day, crowdScore, crowdLabel,
      aiSummary: aiSummary?.slice(0, 200),
      bestDeparture: departureSuggestions?.[0],
      createdAt: new Date().toISOString(),
    };

    // Encode as base64 URL-safe string
    const encoded = Buffer.from(JSON.stringify(shareData)).toString("base64url");
    const shareUrl = `https://clearcommute.vercel.app/share/${encoded}`;

    return NextResponse.json({ shareUrl, encoded });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
