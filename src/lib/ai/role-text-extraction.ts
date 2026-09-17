/**
 * Shared PDF/DOCX/TXT -> text extraction. Used by the admin Architect
 * (src/app/actions/architect.ts#extractRoleText, behind requireAdminScope)
 * and the public Role Builder (src/app/actions/public-builds.ts, behind its
 * own mode/size gates) — pure parsing, no DB access either way.
 */
export async function extractTextFromUpload(
  file: File,
): Promise<{ text: string } | { error: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      const joined = Array.isArray(text) ? text.join("\n") : text;
      return { text: joined.trim() };
    }
    if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: value.trim() };
    }
    if (name.endsWith(".txt") || file.type.startsWith("text/")) {
      return { text: buffer.toString("utf8").trim() };
    }
    return { error: "Unsupported file. Upload a PDF, DOCX, or TXT — or paste the text." };
  } catch {
    return { error: "Could not read that file. Try pasting the text instead." };
  }
}
