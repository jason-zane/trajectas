import { importOutcomeData } from "@/lib/dal/outcomes";
import {
  readRequestBytesWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/security/request-body";
import {
  requireAdminScope,
  AuthorizationError,
  AuthenticationRequiredError,
} from "@/lib/auth/authorization";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await requireAdminScope();
    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > 4.4 * 1024 * 1024)
      return Response.json(
        { error: "Use a file up to 4 MB." },
        { status: 413 },
      );
    const bytes = await readRequestBytesWithLimit(
      request,
      Math.floor(4.4 * 1024 * 1024),
    );
    const bounded = new Response(Buffer.from(bytes), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    });
    const body = await bounded.formData(),
      file = body.get("file"),
      studyId = body.get("studyId");
    if (!(file instanceof File) || typeof studyId !== "string")
      return Response.json(
        { error: "Select a study and source file." },
        { status: 400 },
      );
    return Response.json({
      data: await importOutcomeData(
        studyId,
        file,
        String(body.get("sheet") ?? ""),
      ),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      {
        status:
          error instanceof RequestBodyTooLargeError
            ? 413
            : error instanceof AuthenticationRequiredError
              ? 401
              : error instanceof AuthorizationError
                ? 403
                : 400,
      },
    );
  }
}
