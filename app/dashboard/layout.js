import { redirect } from "next/navigation";
import { auth } from "@/libs/auth";
import config from "@/config";

// TODO: Re-enable auth check before production
// Auth is temporarily disabled for development/preview
const BYPASS_AUTH_FOR_DEV = true;

// This is a server-side component to ensure the user is logged in.
// If not, it will redirect to the login page.
// It's applied to all subpages of /dashboard in /app/dashboard/*** pages
// You can also add custom static UI elements like a Navbar, Sidebar, Footer, etc..
// See https://shipfa.st/docs/tutorials/private-page
export default async function LayoutPrivate({ children }) {
  if (!BYPASS_AUTH_FOR_DEV) {
    const session = await auth();

    if (!session) {
      redirect(config.auth.loginUrl);
    }
  }

  return <>{children}</>;
}
