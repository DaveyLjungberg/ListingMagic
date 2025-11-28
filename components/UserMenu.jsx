"use client";

import { useRouter } from "next/navigation";

export default function UserMenu({ user }) {
  const router = useRouter();

  const handleLogout = async () => {
    // Redirect to logout route which handles the signOut
    router.push("/auth/logout");
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a href="/auth/login" className="btn btn-ghost btn-sm">
          Sign In
        </a>
        <a href="/auth/signup" className="btn btn-primary btn-sm">
          Sign Up
        </a>
      </div>
    );
  }

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost gap-2"
      >
        <div className="avatar placeholder">
          <div className="bg-primary text-primary-content rounded-full w-8">
            <span className="text-sm">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
        </div>
        <span className="hidden sm:inline text-sm max-w-[150px] truncate">
          {user.email}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-box w-52 mt-2 border border-base-200"
      >
        <li className="menu-title">
          <span className="text-xs text-base-content/50 truncate">
            {user.email}
          </span>
        </li>
        <div className="divider my-0"></div>
        <li>
          <button
            onClick={handleLogout}
            className="text-error hover:bg-error/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Logout
          </button>
        </li>
      </ul>
    </div>
  );
}
