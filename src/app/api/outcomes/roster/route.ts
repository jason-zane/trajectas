import { getOutcomeRoster } from "@/lib/dal/outcomes";
import { csvCell } from "@/lib/outcomes/validation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("studyId");
    if (!id)
      return Response.json({ error: "Study required." }, { status: 400 });
    const people = await getOutcomeRoster(id);
    const csv = [
      ["person_key", "email", "business_kpi", "business_context"]
        .map(csvCell)
        .join(","),
      ...people.map((p) =>
        [p.personKey, p.email, "", ""].map(csvCell).join(","),
      ),
    ].join("\r\n");
    return new Response("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="business-outcomes-template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Roster not found or inaccessible." },
      { status: 403 },
    );
  }
}
