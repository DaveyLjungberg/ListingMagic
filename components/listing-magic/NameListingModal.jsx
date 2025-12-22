"use client";

import { useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { supabase } from "@/libs/supabase";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

/**
 * NameListingModal - Credit gatekeeper modal
 * 
 * Prompts user to name their listing before generation.
 * Calls Supabase RPC to check and decrement credits upfront.
 * Redirects to pricing if insufficient credits.
 */
export default function NameListingModal({ isOpen, onClose, onSubmit, user }) {
  const router = useRouter();
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate inputs
    if (!street.trim()) {
      toast.error("Please enter a street address");
      return;
    }

    if (!zipCode.trim()) {
      toast.error("Please enter a ZIP code");
      return;
    }

    // Early auth guard: Check if user is authenticated
    if (!user || !user.email) {
      console.error("❌ User not authenticated:", { user });
      toast.error("User not authenticated");
      return;
    }

    // Debug logs: Verify user object and email before RPC call
    console.log("🔍 Debug: User object:", user);
    console.log("🔍 Debug: User email:", user.email);

    setIsLoading(true);

    try {
      // Call Supabase RPC to check and decrement credits
      // IMPORTANT: Parameter name must match SQL function signature
      const { data, error } = await supabase.rpc("check_and_decrement_credits", {
        user_email: user.email,
      });

      if (error) {
        console.error("❌ RPC error (object):", error);
        console.error("❌ RPC error (JSON):", JSON.stringify(error, null, 2));
        toast.error("Failed to check credits");
        setIsLoading(false);
        return;
      }

      // Parse the response - data.success is a boolean
      if (data && data.success) {
        // Credit successfully used
        const source = data.source === "domain" ? "team pool" : "personal balance";
        
        toast.success(
          `1 Credit Used from ${source} (${data.remaining} remaining)`,
          { duration: 4000, icon: "💳" }
        );

        // Pass address data to parent
        onSubmit({
          street: street.trim(),
          zip_code: zipCode.trim(),
        });

        // Reset form
        setStreet("");
        setZipCode("");
      } else {
        // Insufficient credits
        toast.error(data.message || "Insufficient credits", {
          duration: 3000,
          icon: "⚠️",
        });

        // Close modal and redirect to pricing
        onClose();
        
        setTimeout(() => {
          router.push("/dashboard/pricing");
        }, 500);
      }
    } catch (error) {
      console.error("Error checking credits:", error);
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setStreet("");
    setZipCode("");
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-semibold text-slate-900 mb-2"
                >
                  Name this new listing
                </Dialog.Title>
                
                <p className="text-sm text-slate-600 mb-6">
                  Enter the property address to start your project.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Street Address */}
                  <div>
                    <label
                      htmlFor="street"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="123 Main St"
                      disabled={isLoading}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                      autoFocus
                    />
                  </div>

                  {/* ZIP Code */}
                  <div>
                    <label
                      htmlFor="zipCode"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      id="zipCode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="12345"
                      disabled={isLoading}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Checking...
                        </>
                      ) : (
                        "Start Project"
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

