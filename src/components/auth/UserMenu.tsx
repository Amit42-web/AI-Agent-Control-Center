'use client';

import { UserButton, useUser } from '@clerk/nextjs';

export function UserMenu() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--color-navy-700)] animate-pulse"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium text-white">
          {user.firstName || user.username || 'User'}
        </p>
        <p className="text-xs text-[var(--color-slate-400)]">
          {user.primaryEmailAddress?.emailAddress}
        </p>
      </div>
      <UserButton
        appearance={{
          elements: {
            avatarBox: "w-10 h-10",
            userButtonPopoverCard: "bg-[var(--color-navy-800)] border border-[var(--color-navy-600)]",
            userButtonPopoverActionButton: "hover:bg-[var(--color-navy-700)]",
          }
        }}
        afterSignOutUrl="/sign-in"
      />
    </div>
  );
}
