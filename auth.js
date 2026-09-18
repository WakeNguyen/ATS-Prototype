import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Google],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase()
      return !!email && allowedEmails.includes(email)
    },
    authorized: async ({ auth }) => !!auth,
  },
  pages: {
    signIn: "/login",
  },
})
