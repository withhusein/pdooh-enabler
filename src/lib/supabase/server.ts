import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-bound client for Server Components / Route Handlers acting as the logged-in user. */
export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(list: any) {
  try {
    list.forEach(({ name, value, options }: any) => store.set(name, value, options));
  } catch {
            // Called from a Server Component: middleware refreshes the session instead.
          }
        },
      },
    }
  );
}
