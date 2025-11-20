import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma" // if you don’t have prisma, tell me

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Delete the Google provider from the user's account
  await prisma.account.deleteMany({
    where: {
      userId: session.user.id,
      provider: "google",
    },
  })

  return NextResponse.json({ success: true })
}
