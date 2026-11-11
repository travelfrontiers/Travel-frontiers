import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const locale = /^\/(pt|en|fr)(?:\/|$)/.exec(pathname)?.[1];
    const headers = new Headers(request.headers);
    headers.set("x-tf-locale", locale ?? "pt");
    headers.set("x-tf-path", pathname);
    if (locale || /^\/(admin|_next|static)(?:\/|$)/.test(pathname) || pathname.includes(".")) {
        return NextResponse.next({ request: { headers } });
    }
    const destination = request.nextUrl.clone();
    destination.pathname = "/pt" + pathname;
    return NextResponse.redirect(destination);
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
