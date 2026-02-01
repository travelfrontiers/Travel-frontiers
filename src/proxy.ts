import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Exclude studio, api, static files
    if (
        pathname.startsWith("/admin") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/static") ||
        pathname.includes(".") // Files like favicon.ico
    ) {
        return NextResponse.next();
    }

    // Check if pathname starts with a locale
    const pathnameIsMissingLocale = ["/pt", "/en", "/fr"].every(
        (locale) => !pathname.startsWith(`${locale}/`) && pathname !== locale
    );

    if (pathnameIsMissingLocale) {
        const locale = "pt"; // Default locale
        return NextResponse.redirect(
            new URL(`/${locale}${pathname}`, request.url)
        );
    }
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
