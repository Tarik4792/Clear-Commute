import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getGrade(score: number): { grade: string; label: string; emoji: string } {
  if (score >= 90) return { grade: "A+", label: "Commute Master", emoji: "🏆" };
  if (score >= 80) return { grade: "A",  label: "Rush Beater", emoji: "⚡" };
  if (score >= 70) return { grade: "B+", label: "Smart Commuter", emoji: "🧠" };
  if (score >= 60) return { grade: "B",  label: "Solid Rider", emoji: "🚇" };
  if (score >= 50) return { grade: "C+", label: "Average Commuter", emoji: "😐" };
  if (score >= 40) return { grade: "C",  label: "Rush Hour Regular", emoji: "😅" };
  return { grade: "D", label: "Peak Crowd Rider", emoji: "😬" };
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getClient();

    // Get saved commutes for auto score
    const { data: commutes } = await supabase
      .from("saved_commutes")
      .select("*")
      .eq("user_id", userId);

    // Get trip logs for manual score
    const { data: trips } = await supabase
      .from("trip_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Auto score: based on saved commute times vs peak hours
    // Peak hours: 7-9 AM and 5-7 PM weekdays = low score
    // Off-peak = high score
    let autoScore = 75; // default
    if (commutes && commutes.length > 0) {
      const scores = commutes.map(c => {
        const [h] = (c.depart_time || "08:00").split(":").map(Number);
        const isWeekend = ["Saturday","Sunday"].includes(c.day);
        if (isWeekend) return 85;
        if ((h >= 7 && h <= 9) || (h >= 17 && h <= 19)) return 30; // peak
        if ((h >= 10 && h <= 16) || h >= 20) return 90; // off-peak
        return 65; // shoulder
      });
      autoScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // Manual score: from trip logs
    let manualScore = null;
    let beatRushCount = 0;
    let totalTrips = 0;
    if (trips && trips.length > 0) {
      totalTrips = trips.length;
      beatRushCount = trips.filter(t => t.beat_rush).length;
      const crowdScores = trips
        .filter(t => t.crowd_reported !== null)
        .map(t => 100 - t.crowd_reported);
      if (crowdScores.length > 0) {
        manualScore = Math.round(crowdScores.reduce((a, b) => a + b, 0) / crowdScores.length);
      }
    }

    // Combined score
    const finalScore = manualScore !== null
      ? Math.round((autoScore * 0.4) + (manualScore * 0.6))
      : autoScore;

    const { grade, label, emoji } = getGrade(finalScore);

    return NextResponse.json({
      score: finalScore,
      autoScore,
      manualScore,
      grade,
      label,
      emoji,
      totalTrips,
      beatRushCount,
      recentTrips: trips || [],
    });
  } catch (err) {
    console.error("Score error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, line, origin, destination, crowd_reported, beat_rush, notes, commute_id } = await req.json();
    if (!userId || !line) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const supabase = getClient();
    const crowd_label = crowd_reported < 30 ? "Light" : crowd_reported < 55 ? "Moderate" : crowd_reported < 75 ? "Busy" : "Very Crowded";

    const { data, error } = await supabase
      .from("trip_logs")
      .insert({ user_id: userId, commute_id, line, origin, destination, crowd_reported, crowd_label, beat_rush, notes })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ trip: data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to log trip" }, { status: 500 });
  }
}
