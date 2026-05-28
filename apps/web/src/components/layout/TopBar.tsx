import { OrganizationSwitcher, UserButton, useUser } from '@clerk/clerk-react';

export function TopBar() {
  const { isSignedIn } = useUser();

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b bg-background px-6">
      {isSignedIn ? (
        <>
          <OrganizationSwitcher
            appearance={{
              elements: {
                rootBox: 'flex items-center',
              },
            }}
          />
          <UserButton afterSignOutUrl="/" />
        </>
      ) : null}
    </header>
  );
}
