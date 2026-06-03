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
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ commutes: [] });
    const { data, error } = await getClient()
      .from("saved_commutes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return NextResponse.json({ commutes: data || [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, commute } = await req.json();
    if (!userId || !commute) return NextResponse.json({ error: "Missing data" }, { status: 400 });
    const { data, error } = await getClient()
      .from("saved_commutes")
      .insert({
        user_id: userId,
        name: commute.name,
        transit: commute.transit,
        line: commute.line,
        origin: commute.origin,
        destination: commute.dest,
        depart_time: commute.time,
        day: commute.day,
        purpose: commute.purpose,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ commute: data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, commuteId } = await req.json();
    if (!userId || !commuteId) return NextResponse.json({ error: "Missing data" }, { status: 400 });
    const { error } = await getClient()
      .from("saved_commutes")
      .delete()
      .eq("id", commuteId)
      .eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
