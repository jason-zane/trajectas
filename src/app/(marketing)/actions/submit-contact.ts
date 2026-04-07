"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email address"),
  company: z.string().max(200).optional(),
  message: z.string().min(1, "Message is required").max(5000),
});

export type ContactFormState =
  | { success: true }
  | { error: string; fields?: Record<string, string[]> }
  | undefined;

export async function submitContact(
  _state: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      error: "Please check the form fields.",
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = createAdminClient();

  const { error } = await db.from("contact_submissions").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company ?? null,
    message: parsed.data.message,
  });

  if (error) {
    return { error: "Something went wrong. Please try again." };
  }

  // Send notification email to hello@trajectas.com
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:
        process.env.EMAIL_FROM ??
        "Trajectas <noreply@mail.trajectas.com>",
      to: "hello@trajectas.com",
      subject: `New enquiry from ${parsed.data.name}`,
      text: [
        `Name: ${parsed.data.name}`,
        `Email: ${parsed.data.email}`,
        parsed.data.company ? `Company: ${parsed.data.company}` : null,
        `\nMessage:\n${parsed.data.message}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  } catch {
    // Don't fail the submission if the notification email fails
  }

  return { success: true };
}
