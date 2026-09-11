import { Outfit } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import NavbarTabs from "./NavbarTabs";
import PendingCVClientWrapper from "./components/PendingCVClientWrapper";
import { getPendingCVImports } from "./hitl_actions";
import { getNotifications } from "./notification_actions";
import { auth, signOut } from "../../auth.js";

const outfit = Outfit({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "900"],
  variable: "--font-outfit",
});

export const metadata = {
  title: "CRM-ATS 3.0 Portal",
  description: "Applicant Tracking System & Recruitment CRM 3.0",
};

export default async function RootLayout({ children }) {
  const session = await auth();

  // Fetch pending items and notifications only when user is authenticated
  let pendingItems = [];
  let notifications = [];
  if (session?.user) {
    try {
      const [pendingRes, notifs] = await Promise.all([
        getPendingCVImports(),
        getNotifications()
      ]);
      pendingItems = pendingRes.success ? pendingRes.data : [];
      notifications = notifs || [];
    } catch (e) {
      console.error("[RootLayout] Error fetching notifications:", e);
    }
  }

  return (
    <html lang="en" className={`${outfit.variable} h-screen max-h-screen overflow-hidden antialiased`}>
      <body className="h-screen max-h-screen overflow-hidden font-sans bg-slate-950 text-slate-100 flex flex-col select-none">
        
        {/* TOP MULTI-PAGE NAVIGATION BAR (Only when logged in) */}
        {session?.user && (
          <nav className="h-12 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none">
            
            {/* Brand Logo & Tabs */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-slate-950 text-xs shadow">
                  ATS
                </div>
                <span className="font-black text-sm tracking-tight text-slate-100">
                  CRM-ATS 3.0
                </span>
              </div>

              {/* Dynamic Menu Tabs */}
              <NavbarTabs />
            </div>

            {/* Cloud Database indicator, Bell, User Email & Sign out */}
            <div className="flex items-center space-x-4">
              <PendingCVClientWrapper initialPending={pendingItems} initialNotifications={notifications} />
              <div className="flex items-center space-x-2 text-[11px] text-slate-400" title="Supabase Singapore Live">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden lg:inline font-semibold text-slate-300">Supabase Singapore Live</span>
              </div>

              <div className="flex items-center space-x-3 border-l border-slate-800 pl-3">
                <span className="text-xs text-slate-300 font-medium max-w-[160px] truncate" title={session.user.email}>
                  {session.user.email}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-500/30 text-slate-300 font-medium rounded-md border border-slate-700 transition-colors cursor-pointer"
                    title="Sign out of ATS 3.0"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>

          </nav>
        )}

        {/* PAGE CONTENT (CONSTRAINED TO REMAINING VIEWPORT) */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </main>

      </body>
    </html>
  );
}
