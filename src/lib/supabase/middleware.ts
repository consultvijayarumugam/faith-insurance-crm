import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /forgot-password and /reset-password must stay reachable with no session
// (requesting a link) and reachable with the temporary session a recovery
// link creates (setting a new password) — so they're never redirected to
// /login, and (unlike /login) an existing session doesn't bounce away from
// them either.
const PUBLIC_AUTH_ROUTES = ["/forgot-password", "/reset-password"];

/**
 * Refreshes the Supabase auth session on every request and enforces
 * route-level access:
 *  - unauthenticated users are bounced to /login from any protected route
 *  - authenticated users are bounced away from /login to their dashboard
 *  - /admin/** requires role = admin; /agent/** requires role = agent
 *  - /forgot-password and /reset-password are always public (see above)
 *
 * This is a coarse UX guard only. The real enforcement is Postgres RLS
 * (see supabase/schema.sql) — every data query is still scoped server-side
 * regardless of what this middleware does.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.includes(path);
  const isAuthRoute = path === "/login";
  const isProtectedRoute =
    (path.startsWith("/agent") || path.startsWith("/admin")) && !isPublicAuthRoute;

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (isAuthRoute || isProtectedRoute)) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const homePath = profile?.role === "admin" ? "/admin/dashboard" : "/agent/dashboard";

    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }

    const wrongSection =
      (path.startsWith("/admin") && profile?.role !== "admin") ||
      (path.startsWith("/agent") && profile?.role === "admin");

    if (wrongSection) {
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
