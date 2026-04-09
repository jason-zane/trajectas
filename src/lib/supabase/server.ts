import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? undefined;

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Strip maxAge/expires — auth cookies are session-only (die on browser close)
              const sessionOptions = { ...(options ?? {}) };
              delete sessionOptions.maxAge;
              delete sessionOptions.expires;
              cookieStore.set(name, value, {
                ...sessionOptions,
                ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
              });
            });
          } catch {
            // Ignore cookie writes in server components.
          }
        },
      },
    }
  );
}

export async function createClient() {
  return createServerSupabaseClient();
}
