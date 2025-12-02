/**
 * Simple health check endpoint for wake lock heartbeat fallback.
 * Used to keep the tab active in browsers that don't support Wake Lock API.
 */

export async function GET() {
  return new Response("OK", { status: 200 });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
