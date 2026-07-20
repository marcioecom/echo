import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const publicPrefixes = ["/login", "/sign-up"]
const sessionCookieName = "better-auth.session_token"

export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(sessionCookieName)
  const isPublicRoute = publicPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  )

  if (!hasSessionCookie && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url)
    if (request.nextUrl.pathname !== "/") {
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated visitors on public routes are redirected by the pages
  // themselves after a real session check, so a stale cookie cannot cause a
  // redirect loop between proxy and app shell.
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
