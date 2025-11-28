// This layout now relies on middleware.js to protect dashboard routes
// The middleware uses Supabase Auth to check if user is logged in
// and redirects to /auth/login if not authenticated

export default async function LayoutPrivate({ children }) {
  // Auth is handled by middleware.js with Supabase
  // This layout just passes through children
  return <>{children}</>;
}
