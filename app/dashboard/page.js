import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Redirect /dashboard to /dashboard/generate
export default async function Dashboard() {
  redirect("/dashboard/generate");
}
