import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // mp4/webm join the image extensions here for the first-job takeover's
    // hero demo. Without them the auth gate 307s /hero/*.mp4 and *.webm to
    // /login and the video silently never plays, while the .jpg poster loads
    // fine because jpg was already excluded. Static assets have nothing to
    // gate: the takeover is behind auth, the file it plays does not need to be.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)",
  ],
}
