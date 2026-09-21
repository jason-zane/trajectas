"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRight, Check, Upload, LoaderCircle } from "lucide-react";
import { extractRoleTextUpload } from "@/app/actions/public-builds";
import { PUBLIC_BUILDS_MAX_PD_CHARS } from "@/lib/public-builds/shared";
import { BuilderHeading, BuildError } from "./builder-frame";

export interface RoleDraft { roleTitle: string; pdText: string }

export function BriefStep({ email, draft, onChange, onSubmit, error }: { email: string; draft: RoleDraft; onChange: (draft: RoleDraft) => void; onSubmit: () => void; error: string | null }) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  function upload(file: File) {
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) { setUploadError("Choose a file smaller than 5 MB, or paste the text instead."); return; }
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) { setUploadError("Choose a PDF, Word (.docx) or text file."); return; }
    startUpload(async () => {
      try {
        const data = new FormData(); data.append("file", file);
        const result = await extractRoleTextUpload(data);
        if ("error" in result) { setUploadError(result.error); return; }
        onChange({ ...draft, pdText: result.text.slice(0, PUBLIC_BUILDS_MAX_PD_CHARS) }); setUploadedName(file.name);
      } catch { setUploadError("We couldn’t read the document. Try again, or paste its text below."); }
    });
  }
  return <div className="px-enter"><BuilderHeading title="What does the role call for?">Add the role’s responsibilities and context. We’ll use them to recommend capabilities from the assessment library.</BuilderHeading><div className="rb-layout"><form className="rb-form" onSubmit={e => { e.preventDefault(); if (!uploading) onSubmit(); }}>
    <div className="rb-field"><label htmlFor="job-title">Role title</label><input id="job-title" required maxLength={300} value={draft.roleTitle} disabled={uploading} onChange={e => onChange({ ...draft, roleTitle: e.target.value })} placeholder="For example, Operations Manager" autoComplete="off" /></div>
    <div className="rb-field"><div className="rb-field-top"><label htmlFor="pd">Position description</label><button type="button" className="px-text-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? <LoaderCircle size={16} className="rb-spinner" aria-hidden /> : <Upload size={16} aria-hidden />}{uploading ? "Reading your document…" : "Upload a document"}</button><input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" aria-label="Upload position description" hidden onChange={e => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} /></div>
    <textarea id="pd" rows={10} maxLength={PUBLIC_BUILDS_MAX_PD_CHARS} required disabled={uploading} value={draft.pdText} onChange={e => { onChange({ ...draft, pdText: e.target.value }); setUploadedName(null); }} placeholder="Paste the responsibilities, expectations and working context for this role…" aria-describedby="pd-help pd-count" />
    <div className="rb-field-bottom"><p id="pd-help" className="rb-help">PDF, Word or text · Up to 5 MB<br />Remove names and any confidential details that aren’t needed to describe the role.</p><span id="pd-count" className="rb-help">{draft.pdText.length.toLocaleString("en-AU")} / 20,000</span></div>
    {uploadedName && <p role="status" className="rb-help">Text added from {uploadedName}. Review it before continuing.</p>}
    {uploadError && <BuildError>{uploadError}</BuildError>}</div>
    {error && <BuildError>{error}</BuildError>}
    <div className="px-actions"><button type="submit" className="px-button" disabled={uploading}>Find relevant capabilities <ArrowRight size={18} aria-hidden /></button></div>
    <p className="rb-help">You’ll review the recommendations before creating an assessment. Your submitted description is cleared after 30 days.</p>
  </form><aside className="rb-aside"><h2>Start with the work.</h2><p>The more clearly you describe the role, the more useful the recommendations can be.</p><ul><li><Check size={17} aria-hidden />What the person is responsible for</li><li><Check size={17} aria-hidden />The decisions they need to make</li><li><Check size={17} aria-hidden />Who they work with and the context</li></ul><p>You’ll choose the assessment length after seeing the recommendations.</p><p className="rb-verified"><Check size={15} aria-hidden />Verified: {email}</p></aside></div></div>;
}
