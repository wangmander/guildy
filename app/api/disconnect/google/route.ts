import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return new Response("Not authenticated", { status: 401 });
  }

  await prisma.account.deleteMany({
    where: {
      provider: "google",
      user: {
        email: session.user.email
      }
    }
  });

  return Response.json({ success: true });
}

