import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client: used only for the privileged delete call, never exposed to the browser.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json({ error: "Missing session token" }, { status: 401 });
    }

    // Verify the token against Supabase to get the real, authenticated user.
    // We never trust a user id sent directly from the client.
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    const userId = userData.user.id;

    // Delete app-owned data first. Add any tables here that reference this user
    // and are NOT already set up with ON DELETE CASCADE on their foreign key.
    const tablesToClean: { table: string; column: string }[] = [
      { table: "saved_commutes", column: "user_id" },
      { table: "trip_logs", column: "user_id" },
      { table: "crowd_reports", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
    ];

    for (const { table, column } of tablesToClean) {
      const { error: cleanupError } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, userId);

      if (cleanupError) {
        console.error(`Cleanup failed for ${table}:`, cleanupError.message);
      }
    }

    // Delete the actual auth user. This is the step Apple's review is checking for.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete account" },
      { status: 500 }
    );
  }
}
