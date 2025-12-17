"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { supabase } from "@/libs/supabase";

/**
 * Pricing Page - Credit purchase options
 * Matches "Invisible Luxury" aesthetic with Slate-50 background and Indigo-600 primary
 */
export default function PricingPage() {
  const [user, setUser] = useState(null);
  const [creditScope, setCreditScope] = useState("personal"); // "personal" or "team"

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Derive email and domain with fallback
  const email = user?.email ?? "agent@example.com";
  const domain = email.split("@")[1] ?? "example.com";

  const pricingTiers = [
    {
      id: "starter",
      name: "Starter",
      credits: 1,
      price: 20,
      pricePerCredit: 20,
      badge: null,
      borderClass: "border-slate-200",
      shadowClass: "shadow-sm",
    },
    {
      id: "pro",
      name: "Pro",
      credits: 10,
      price: 150,
      pricePerCredit: 15,
      badge: { text: "Most Popular", color: "bg-teal-100 text-teal-700 border-teal-200" },
      borderClass: "border-slate-200",
      shadowClass: "shadow-sm",
    },
    {
      id: "agency",
      name: "Agency",
      credits: 50,
      price: 400,
      pricePerCredit: 8,
      badge: null,
      borderClass: "border-indigo-600",
      shadowClass: "shadow-[0_0_20px_rgba(79,70,229,0.15)]",
    },
  ];

  const features = [
    "MLS Description",
    "Public Remarks",
    "Video Script",
    "Feature Sheet",
  ];

  const handleSelectPackage = (tierId) => {
    // TODO: Wire up Stripe checkout
    console.log(`Selected package: ${tierId}`);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <DashboardHeader
        user={user}
        propertyAddress="Pricing"
      />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Link */}
        <Link
          href="/dashboard/generate"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Generator</span>
        </Link>

        {/* Hero Text */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Invest in your Listing Pipeline
          </h1>
          <p className="text-lg text-slate-600">
            Purchase credits to generate premium listing packages instantly.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`bg-white rounded-2xl border ${tier.borderClass} ${tier.shadowClass} p-8 relative transition-all hover:scale-[1.02]`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${tier.badge.color}`}>
                    {tier.badge.text}
                  </span>
                </div>
              )}

              {/* Tier Name */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {tier.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-slate-900">
                    ${tier.price}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  {tier.credits} {tier.credits === 1 ? "Credit" : "Credits"}
                  {tier.pricePerCredit < tier.price && (
                    <span className="text-teal-600 font-medium ml-1">
                      (${tier.pricePerCredit}/ea)
                    </span>
                  )}
                </p>
              </div>

              {/* Select Button */}
              <button
                onClick={() => handleSelectPackage(tier.id)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-6"
              >
                Select Package
              </button>

              {/* Features List */}
              <div className="space-y-3">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center">
                      <Check className="w-3 h-3 text-indigo-600" />
                    </div>
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Team Logic Section */}
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            Who can use these credits?
          </h2>

          <div className="space-y-3">
            {/* Personal Option */}
            <label
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                creditScope === "personal"
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="creditScope"
                value="personal"
                checked={creditScope === "personal"}
                onChange={(e) => setCreditScope(e.target.value)}
                className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-600 focus:ring-2 focus:ring-offset-2"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-900 mb-1">
                  Personal
                </div>
                <div className="text-sm text-slate-600">
                  Only <span className="font-medium text-slate-900">{email}</span> can use credits
                </div>
              </div>
            </label>

            {/* Team Option */}
            <label
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                creditScope === "team"
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="creditScope"
                value="team"
                checked={creditScope === "team"}
                onChange={(e) => setCreditScope(e.target.value)}
                className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-600 focus:ring-2 focus:ring-offset-2"
              />
              <div className="flex-1">
                <div className="font-semibold text-slate-900 mb-1">
                  Team
                </div>
                <div className="text-sm text-slate-600">
                  Any agent with <span className="font-medium text-slate-900">@{domain}</span> can use credits
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}

