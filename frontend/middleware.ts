import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to enforce separate admin UI when running with NEXT_PUBLIC_ADMIN=true.
 * In admin mode, only routes under `/admin` are allowed; all other routes are redirected
 * to `/admin` (or a 404 if they do not exist). This creates an isolated window for the
 * Super Admin while tenants continue to use the normal UI on the default port.
 */
export function middleware(request: NextRequest) {
  const isAdmin = process.env.NEXT_PUBLIC_ADMIN === 'true';
  const { pathname } = request.nextUrl;

  if (isAdmin) {
    // If Super Admin is in an active emergency session inspecting a granted tenant, allow all routes
    const emergencyTenant = request.cookies.get('fg-emergency-tenant')?.value;
    if (emergencyTenant) {
      return NextResponse.next();
    }

    // Allow admin routes and static assets.
    if (pathname.startsWith('/admin') || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
      return NextResponse.next();
    }
    // Redirect any non‑admin page to the admin landing page.
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }

  // Normal tenant mode – allow everything.
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*', // Run for all paths.
};
