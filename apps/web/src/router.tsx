import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { AppShell } from './components/layout/AppShell';
import { AdminGuard } from './admin/AdminGuard';
import { AdminShell } from './admin/layout/AdminShell';
import { HomePage } from './pages/Home';
import { ItemsPage } from './pages/Items';
import { ConfigPage } from './pages/Config';

// Admin pages are lazy-loaded — low-traffic, keeps the initial bundle small.
const AppsPage = lazy(() =>
  import('./admin/apps/AppsPage').then((m) => ({ default: m.AppsPage })),
);
const ProductsPage = lazy(() =>
  import('./admin/products/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const ProductDetailPage = lazy(() =>
  import('./admin/products/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })),
);

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
    ],
  },
  {
    path: '/admin',
    element: (
      <Protected>
        <AdminGuard>
          <AdminShell />
        </AdminGuard>
      </Protected>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/apps" replace /> },
      { path: 'apps', element: <AppsPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'finders', element: <div>TBD Phase 03</div> },
      { path: 'payouts', element: <div>TBD Phase 05</div> },
      { path: 'audit', element: <div>TBD Phase 05</div> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);
