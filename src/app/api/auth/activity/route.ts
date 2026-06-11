import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedUserId } from "@/lib/auth/claims";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const userId = await getVerifiedUserId(supabase);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The middleware automatically updates tf_last_activity on every request,
  // including this one — no additional work needed here.
  return NextResponse.json({ ok: true });
}
