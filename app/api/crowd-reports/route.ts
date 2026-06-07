import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  try {
    const line = req.nextUrl.searchParams.get("line");
    if (!line) return NextResponse.json({ reports: [] });

    const { data, error } = await getClient()
      .from("crowd_reports")
      .select("*")
      .eq("line", line)
      .gt("expires_at", new Date().toISOString())
      .order("reported_at", { ascending: false });

    if (error) throw error;

    const reports = data || [];
    const count = reports.length;
    const avgScore = count > 0
      ? Math.round(reports.reduce((a, b) => a + b.crowd_score, 0) / count)
      : null;

    const levelCounts: Record<string, number> = {};
    reports.forEach(r => { levelCounts[r.crowd_level] = (levelCounts[r.crowd_level] || 0) + 1; });
    const topLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return NextResponse.json({ reports, count, avgScore, topLevel });
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { line, origin, destination, crowd_level, crowd_score, user_id } = await req.json();
    if (!line || !crowd_level || crowd_score === undefined) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data, error } = await getClient()
      .from("crowd_reports")
      .insert({ line, origin, destination, crowd_level, crowd_score, user_id: user_id || null })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ report: data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
