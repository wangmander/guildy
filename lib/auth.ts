import GoogleProvider from "next-auth/providers/google"
import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // token only exists on SIGN IN / RE-CONSENT
      if (account?.access_token) token.accessToken = account.access_token
      if (account?.refresh_token) token.refreshToken = account.refresh_token
      return token
    },
    async session({ session, token }) {
      ;(session as any).accessToken = token.accessToken
      ;(session as any).refreshToken = token.refreshToken
      return session
    },
  },
}
