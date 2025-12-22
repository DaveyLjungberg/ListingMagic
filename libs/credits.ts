/**
 * Credits API Client
 *
 * Domain-aware credit system for QuickList.
 * Credits are checked in order: Domain pool first, then Personal balance.
 */

export interface CreditBalance {
  domain_credits: number;
  personal_credits: number;
  total_credits: number;
  domain: string | null;
}

export interface CreditUsageResult {
  success: boolean;
  source: "domain" | "personal" | null;
  remaining: number;
  message: string;
}

/**
 * Get the current user's credit balance
 * Returns domain credits + personal credits
 */
export async function getCreditBalance(): Promise<{
  success: boolean;
  data?: CreditBalance;
  error?: string;
}> {
  try {
    const response = await fetch("/api/credits", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Failed to fetch credit balance",
      };
    }

    return {
      success: true,
      data: data.data as CreditBalance,
    };
  } catch (error) {
    console.error("Error fetching credit balance:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch credits",
    };
  }
}

/**
 * Consume a credit for generation
 * Checks domain credits first, then personal credits
 *
 * @returns Success with source ('domain' or 'personal') and remaining count
 */
export async function consumeCredit(): Promise<{
  success: boolean;
  data?: CreditUsageResult;
  error?: string;
}> {
  try {
    const response = await fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Insufficient credits",
        data: {
          success: false,
          source: null,
          remaining: 0,
          message: data.error || "Insufficient credits",
        },
      };
    }

    return {
      success: true,
      data: {
        success: true,
        source: data.data.source,
        remaining: data.data.remaining,
        message: data.data.message,
      },
    };
  } catch (error) {
    console.error("Error using credit:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to use credit",
    };
  }
}

/**
 * Check if user has any credits available
 * Useful for UI state (enable/disable generate button)
 */
export async function hasCredits(): Promise<boolean> {
  const result = await getCreditBalance();
  return result.success && (result.data?.total_credits ?? 0) > 0;
}

/**
 * Format credit balance for display
 * e.g., "15 credits (10 team + 5 personal)"
 */
export function formatCreditBalance(balance: CreditBalance): string {
  const { domain_credits, personal_credits, total_credits } = balance;

  if (total_credits === 0) {
    return "0 credits";
  }

  if (domain_credits > 0 && personal_credits > 0) {
    return `${total_credits} credits (${domain_credits} team + ${personal_credits} personal)`;
  }

  if (domain_credits > 0) {
    return `${domain_credits} team credits`;
  }

  return `${personal_credits} personal credits`;
}
