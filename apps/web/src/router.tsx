import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/Home';
import { ItemsPage } from './pages/Items';
import { ConfigPage } from './pages/Config';

const Protected = ({ children }: { children: React.ReactNode }) => (
  <>
    <SignedIn>{children}</SignedIn>
    <SignedOut>
      <RedirectToSignIn />
    </SignedOut>
  </>
);

const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Protected>
        <AppShell />
      </Protected>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'items', element: <ItemsPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);
