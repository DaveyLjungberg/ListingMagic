"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Home, Coins } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { getCreditBalance } from "@/libs/credits";

/**
 * QuickList Dashboard Header
 * Sticky top bar with branding, property address, and system status
 */
export default function DashboardHeader({ user, propertyAddress }) {
  const [creditBalance, setCreditBalance] = useState(null);

  // Fetch credit balance when user is available
  useEffect(() => {
    if (!user?.email) {
      setCreditBalance(null);
      return;
    }

    const fetchBalance = async () => {
      const result = await getCreditBalance();
      if (result.success) {
        setCreditBalance(result.data);
      }
    };

    fetchBalance();
  }, [user?.email]);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-base-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: QuickList Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Home className="w-5 h-5 text-primary-navy" />
            </div>
            <h1 className="text-xl font-serif font-semibold text-primary-navy">
              QuickList
            </h1>
          </div>

          {/* Center: Property Address or "New Listing" */}
          <div className="hidden md:block flex-1 mx-8">
            <p className="text-center font-serif text-primary-navy truncate max-w-md mx-auto">
              {propertyAddress || "New Listing"}
            </p>
          </div>

          {/* Right: System Status & User Menu */}
          <div className="flex items-center gap-4">
            {/* System Online Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-subtle" />
              <span className="text-xs font-medium text-success-600 hidden sm:inline">
                System Online
              </span>
            </div>
            
            {/* Credit Balance & Buy Credits */}
            <div className="flex items-center gap-2">
              {creditBalance !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    {creditBalance.total_credits}
                  </span>
                  {creditBalance.domain_credits > 0 && creditBalance.personal_credits > 0 && (
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      ({creditBalance.domain_credits}+{creditBalance.personal_credits})
                    </span>
                  )}
                </div>
              )}
              <Link
                href="/dashboard/pricing"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Buy Credits
              </Link>
            </div>
            
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
