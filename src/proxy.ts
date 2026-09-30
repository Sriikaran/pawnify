import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proxy and CORS handling for API and Storage routes
  if (pathname.startsWith("/api/") || pathname.startsWith("/proxy/")) {
    const response = NextResponse.next();

    // Standard proxy forwarding headers and dynamic CORS for credentials support
    const origin = request.headers.get("origin");
    response.headers.set("X-Forwarded-Host", request.headers.get("host") || request.nextUrl.host || "localhost:3000");
    response.headers.set("X-Proxy-By", "Pawnify-Proxy-Service");
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, X-Supabase-Auth, apikey, x-client-info, Cookie, Set-Cookie"
    );

    // Handle OPTIONS preflight requests for proxied endpoints
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/proxy/:path*"],
};
