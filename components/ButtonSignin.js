/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import config from "@/config";

// A simple button to sign in with Supabase Auth.
// It automatically redirects user to callbackUrl (config.auth.callbackUrl) after login, which is normally a private page for users to manage their accounts.
// If the user is already logged in, it will show their profile picture & redirect them to callbackUrl immediately.
const ButtonSignin = ({ text = "Get started", extraStyle, user, isLoading }) => {
  if (isLoading) {
    return (
      <button className={`btn ${extraStyle ? extraStyle : ""}`} disabled>
        <span className="loading loading-spinner loading-xs"></span>
      </button>
    );
  }

  if (user) {
    return (
      <Link
        href={config.auth.callbackUrl}
        className={`btn ${extraStyle ? extraStyle : ""}`}
      >
        <span className="w-6 h-6 bg-base-300 flex justify-center items-center rounded-full shrink-0">
          {user.email?.charAt(0).toUpperCase() || "U"}
        </span>
        {user.email || "Account"}
      </Link>
    );
  }

  return (
    <Link
      href="/auth/login"
      className={`btn ${extraStyle ? extraStyle : ""}`}
    >
      {text}
    </Link>
  );
};

export default ButtonSignin;
