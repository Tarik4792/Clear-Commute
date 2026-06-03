import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { action, email, password } = await req.json();

    if (action === "signup") {
      const { data, error } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true
      });
      if (error) throw error;
      return NextResponse.json({ user: data.user });
    }

    if (action === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return NextResponse.json({ user: data.user, session: data.session });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auth failed" },
      { status: 500 }
    );
  }
}
