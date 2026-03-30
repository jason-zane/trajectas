import type { NextRequest } from "next/server";
import { completeSupportLaunch } from "@/lib/auth/support-launch";

export async function GET(request: NextRequest) {
  return completeSupportLaunch(request, "partner");
}
