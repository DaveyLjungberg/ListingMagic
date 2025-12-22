import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDomainFromEmail } from "@/libs/utils";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * POST /api/stripe/checkout
 * 
 * Create a Stripe Checkout Session for purchasing credits.
 * Supports "personal" (email-based) and "domain" (team-based) credit purchases.
 * 
 * Request body:
 * {
 *   priceId: string;        // Stripe Price ID (e.g., "price_1ABC...")
 *   quantity: number;       // Quantity for Stripe line item (usually 1 for per-pack pricing)
 *   creditsAmount: number;  // Actual credits to grant after purchase (1/10/50)
 *   creditType: "personal" | "domain";
 *   userEmail: string;      // User's email address
 *   successUrl: string;     // Redirect URL after successful payment
 *   cancelUrl: string;      // Redirect URL if payment is cancelled
 * }
 * 
 * Response:
 * { url: string }          // Stripe Checkout URL to redirect user to
 */
export async function POST(req) {
  // Check if Stripe is configured
  if (!stripe) {
    console.error("Stripe is not configured. Missing STRIPE_SECRET_KEY");
    return NextResponse.json(
      { error: "Stripe configuration missing" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { priceId, quantity, creditsAmount, creditType, userEmail, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!priceId) {
      return NextResponse.json(
        { error: "priceId is required" },
        { status: 400 }
      );
    }

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive number" },
        { status: 400 }
      );
    }

    if (!creditsAmount || typeof creditsAmount !== "number" || creditsAmount <= 0) {
      return NextResponse.json(
        { error: "creditsAmount must be a positive number" },
        { status: 400 }
      );
    }

    if (!creditType || !["personal", "domain"].includes(creditType)) {
      return NextResponse.json(
        { error: "creditType must be 'personal' or 'domain'" },
        { status: 400 }
      );
    }

    if (!userEmail || typeof userEmail !== "string" || !userEmail.includes("@")) {
      return NextResponse.json(
        { error: "valid userEmail is required" },
        { status: 400 }
      );
    }

    if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: "successUrl and cancelUrl are required" },
        { status: 400 }
      );
    }

    // Validate URLs are from allowed origins (prevent open-redirect)
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_SITE_URL,
      "https://listing-magic.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ].filter(Boolean);

    const isValidUrl = (url) => {
      try {
        const parsed = new URL(url);
        return allowedOrigins.some((origin) => url.startsWith(origin));
      } catch {
        return false;
      }
    };

    if (!isValidUrl(successUrl) || !isValidUrl(cancelUrl)) {
      return NextResponse.json(
        { error: "Invalid successUrl or cancelUrl" },
        { status: 400 }
      );
    }

    // Compute targetIdentifier based on creditType
    let targetIdentifier;

    if (creditType === "personal") {
      targetIdentifier = userEmail.toLowerCase();
    } else {
      // creditType === "domain"
      targetIdentifier = getDomainFromEmail(userEmail);
      
      if (!targetIdentifier) {
        return NextResponse.json(
          { error: "Could not extract domain from email" },
          { status: 400 }
        );
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: quantity, // Line item quantity (usually 1 for per-pack pricing)
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      metadata: {
        targetIdentifier: targetIdentifier,
        creditsAmount: String(creditsAmount), // Use creditsAmount for fulfillment
        creditType: creditType,
      },
    });

    console.log(
      `Stripe checkout created: ${creditsAmount} credits (${creditType}) for ${targetIdentifier}`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating Stripe checkout:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

