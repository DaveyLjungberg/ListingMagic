import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Use dedicated webhook secret for credits, fallback to general secret
const webhookSecret =
  process.env.STRIPE_CREDITS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

// Create Supabase service client for admin operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service role configuration");
  }

  return createClient(url, serviceKey);
}

/**
 * POST /api/stripe/webhook
 * 
 * Stripe webhook handler for credit purchases.
 * Listens for checkout.session.completed events and updates Supabase credit_balances.
 * 
 * This endpoint is separate from /api/webhook/stripe (which handles subscriptions).
 * Configure this webhook URL in your Stripe Dashboard:
 * https://listing-magic.vercel.app/api/stripe/webhook
 * 
 * Events handled:
 * - checkout.session.completed: Add credits to user/domain balance
 */
export async function POST(req) {
  // Check if Stripe is configured
  if (!stripe || !webhookSecret) {
    console.error(
      "Stripe webhook configuration missing. Need STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (or STRIPE_CREDITS_WEBHOOK_SECRET)"
    );
    return NextResponse.json(
      { error: "Stripe configuration missing" },
      { status: 500 }
    );
  }

  try {
    // Get raw body for signature verification
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    const eventType = event.type;
    const data = event.data;

    console.log(`Stripe webhook received: ${eventType}`);

    // Handle checkout.session.completed
    if (eventType === "checkout.session.completed") {
      const session = data.object;
      const metadata = session.metadata;

      if (!metadata) {
        console.warn("Checkout session has no metadata, skipping");
        return NextResponse.json({ received: true });
      }

      const { targetIdentifier, creditsAmount, creditType } = metadata;

      // Validate metadata
      if (!targetIdentifier) {
        console.error("Missing targetIdentifier in metadata");
        return NextResponse.json(
          { error: "Invalid metadata: missing targetIdentifier" },
          { status: 400 }
        );
      }

      if (!creditsAmount) {
        console.error("Missing creditsAmount in metadata");
        return NextResponse.json(
          { error: "Invalid metadata: missing creditsAmount" },
          { status: 400 }
        );
      }

      const amount = parseInt(creditsAmount, 10);

      if (isNaN(amount) || amount <= 0) {
        console.error(`Invalid creditsAmount: ${creditsAmount}`);
        return NextResponse.json(
          { error: "Invalid metadata: creditsAmount must be positive integer" },
          { status: 400 }
        );
      }

      // Add credits to Supabase using RPC
      try {
        const supabase = getServiceClient();

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "add_credits",
          {
            owner: targetIdentifier.toLowerCase(),
            amount: amount,
          }
        );

        if (rpcError) {
          console.error("Error adding credits via RPC:", rpcError);
          return NextResponse.json(
            { error: "Failed to add credits" },
            { status: 500 }
          );
        }

        // Track revenue in user profile
        const revenueAmount = session.amount_total / 100; // Convert cents to dollars
        const targetEmail = creditType === 'domain' 
          ? session.customer_email 
          : targetIdentifier;

        if (targetEmail) {
          try {
            await supabase.rpc('update_user_revenue', {
              user_email_param: targetEmail,
              amount_param: revenueAmount
            });
          } catch (revenueError) {
            console.error("Failed to update revenue:", revenueError);
          }
        }

        console.log(
          `✅ Credits added successfully:`,
          JSON.stringify({
            type: creditType,
            targetIdentifier: targetIdentifier,
            amount: amount,
            newBalance: rpcData.new_balance,
            sessionId: session.id,
          })
        );

        return NextResponse.json({
          received: true,
          creditsAdded: amount,
          targetIdentifier: targetIdentifier,
          newBalance: rpcData.new_balance,
        });
      } catch (error) {
        console.error("Error in credit addition:", error);
        return NextResponse.json(
          { error: "Failed to process credit addition" },
          { status: 500 }
        );
      }
    }

    // For other event types, just acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}


