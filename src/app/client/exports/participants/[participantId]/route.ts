import type { NextRequest } from "next/server";
import { launchParticipantExport } from "@/lib/auth/report-launch";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await context.params;
  return launchParticipantExport(request, "client", participantId);
}
