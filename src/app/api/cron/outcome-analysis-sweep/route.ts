import { timingSafeEqual } from "node:crypto";
import { runNextOutcomeJob } from "@/lib/dal/outcome-jobs";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
      ? `Bearer ${process.env.CRON_SECRET}`
      : "",
    actual = request.headers.get("authorization") ?? "";
  if (
    !expected ||
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await Promise.all([
      runNextOutcomeJob(),
      runNextOutcomeJob(),
    ]);
    return Response.json({ started: results.filter(Boolean).length });
  } catch {
    return Response.json(
      { error: "Unable to process the analysis queue." },
      { status: 500 },
    );
  }
}
