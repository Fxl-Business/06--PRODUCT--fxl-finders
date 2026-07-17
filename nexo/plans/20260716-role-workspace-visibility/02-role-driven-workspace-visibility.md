---
id: 02-role-driven-workspace-visibility
milestone: v2.2.0
status: done
depends_on: []
files_modified:
  - apps/web/src/sales-ops/navigation.ts
  - apps/web/src/sales-ops/SalesOpsApp.tsx
  - apps/web/src/sales-ops/__tests__/navigation.test.ts
  - apps/web/src/sales-ops/__tests__/routing.test.tsx
acceptance: "given a user's Hub role set, when the app loads, then only the workspaces allowed by the role-visibility rule are shown (seller/finder-only → only Meus dados; team → Tático/Operacional/Cadastros; team+personal → all four) and the viewing-level switcher no longer exists"
---

# 02 - Role-driven workspace visibility

## Oracle Tests

Primary locked oracle (rewritten to the new role-set model, must be the RED artifact written first):
`pnpm --filter @fxl-sales/web test src/sales-ops/__tests__/navigation.test.ts`

Component visibility oracle (SalesOpsApp wiring, switcher removal, meus-dados landing):
`pnpm --filter @fxl-sales/web test src/sales-ops/__tests__/routing.test.tsx`

Type and lint guard for the component wiring:
`pnpm --filter @fxl-sales/web type-check`

The test script is `vitest run` (confirmed in `apps/web/package.json`), so a path argument runs only that file.

## Plan

The change is fully localized: only `navigation.ts` and the top of `SalesOpsApp` (plus `titleForView`, the sidebar commissions badge, and the header identity block) consume the model.
No child view component receives the old `activeRoleView`, so no view components change.
No API, router, or legacy-tree change is needed.

### Step 1 (RED): rewrite `apps/web/src/sales-ops/__tests__/navigation.test.ts` to the new role-set model

Replace the entire file with the following.
This encodes every locked decision and fails against the current single-role model.

```ts
import { describe, expect, it } from 'vitest';
import type { AppRole } from '@/auth/claims';
import {
  buildSalesOpsPath,
  getDefaultSalesOpsRoute,
  getSalesOpsNavigation,
  getVisibleWorkspaces,
  resolveSalesOpsRoute,
  salesOpsWorkspaces,
  workspaceForView,
} from '../navigation';

const team: AppRole[] = ['admin'];
const seller: AppRole[] = ['seller'];
const finder: AppRole[] = ['finder'];
const sellerFinder: AppRole[] = ['seller', 'finder'];
const everything: AppRole[] = ['admin', 'seller', 'finder'];

describe('sales operations navigation', () => {
  it('exposes the exact workspace catalogue including meus-dados', () => {
    expect(salesOpsWorkspaces).toEqual([
      { id: 'tatico', label: 'Tático', description: 'Indicadores e painéis' },
      { id: 'operacional', label: 'Operacional', description: 'Vendas e conferência' },
      { id: 'cadastros', label: 'Cadastros', description: 'Catálogo e regras' },
      { id: 'meus-dados', label: 'Meus dados', description: 'Painel e comissões pessoais' },
    ]);
  });

  it('derives visible workspaces from the Hub role set', () => {
    expect(getVisibleWorkspaces(team)).toEqual(['tatico', 'operacional', 'cadastros']);
    expect(getVisibleWorkspaces(seller)).toEqual(['meus-dados']);
    expect(getVisibleWorkspaces(finder)).toEqual(['meus-dados']);
    expect(getVisibleWorkspaces(sellerFinder)).toEqual(['meus-dados']);
    expect(getVisibleWorkspaces(everything)).toEqual([
      'tatico',
      'operacional',
      'cadastros',
      'meus-dados',
    ]);
    expect(getVisibleWorkspaces([])).toEqual([]);
  });

  it('renders fixed team navigation for the team workspaces', () => {
    expect(getSalesOpsNavigation('tatico', team).map((item) => item.id)).toEqual([
      'dashboard',
      'vendedores',
      'finders',
    ]);
    expect(getSalesOpsNavigation('operacional', team).map((item) => item.id)).toEqual([
      'vendas',
      'comissoes',
    ]);
    expect(getSalesOpsNavigation('cadastros', team).map((item) => item.id)).toEqual([
      'produtos',
      'clientes',
      'geral',
    ]);
  });

  it('renders the union of personal items in meus-dados', () => {
    expect(getSalesOpsNavigation('meus-dados', seller).map((item) => item.id)).toEqual([
      'vendedores',
      'comissoes',
    ]);
    expect(getSalesOpsNavigation('meus-dados', seller).map((item) => item.label)).toEqual([
      'Meu painel',
      'Comissões',
    ]);
    expect(getSalesOpsNavigation('meus-dados', finder).map((item) => item.id)).toEqual([
      'finders',
      'vendas',
    ]);
    expect(getSalesOpsNavigation('meus-dados', finder).map((item) => item.label)).toEqual([
      'Meu painel',
      'Indicações',
    ]);
    expect(getSalesOpsNavigation('meus-dados', sellerFinder).map((item) => item.id)).toEqual([
      'vendedores',
      'comissoes',
      'finders',
      'vendas',
    ]);
  });

  it('defaults team users to tatico and personal-only users to meus-dados', () => {
    expect(getDefaultSalesOpsRoute(team)).toEqual({ workspace: 'tatico', view: 'dashboard' });
    expect(getDefaultSalesOpsRoute(seller)).toEqual({ workspace: 'meus-dados', view: 'vendedores' });
    expect(getDefaultSalesOpsRoute(finder)).toEqual({ workspace: 'meus-dados', view: 'finders' });
    expect(getDefaultSalesOpsRoute(sellerFinder)).toEqual({
      workspace: 'meus-dados',
      view: 'vendedores',
    });
    expect(getDefaultSalesOpsRoute(everything)).toEqual({ workspace: 'tatico', view: 'dashboard' });
  });

  it('honours a visible preferred workspace and ignores an invisible one', () => {
    expect(getDefaultSalesOpsRoute(team, 'operacional')).toEqual({
      workspace: 'operacional',
      view: 'vendas',
    });
    expect(getDefaultSalesOpsRoute(team, 'cadastros')).toEqual({
      workspace: 'cadastros',
      view: 'produtos',
    });
    expect(getDefaultSalesOpsRoute(everything, 'meus-dados')).toEqual({
      workspace: 'meus-dados',
      view: 'vendedores',
    });
    expect(getDefaultSalesOpsRoute(seller, 'tatico')).toEqual({
      workspace: 'meus-dados',
      view: 'vendedores',
    });
  });

  it('keeps valid routes and reports no redirect', () => {
    expect(resolveSalesOpsRoute({ workspace: 'tatico', view: 'dashboard' }, team)).toEqual({
      route: { workspace: 'tatico', view: 'dashboard' },
      path: '/tatico/dashboard',
      redirect: false,
    });
    expect(resolveSalesOpsRoute({ workspace: 'meus-dados', view: 'comissoes' }, seller)).toEqual({
      route: { workspace: 'meus-dados', view: 'comissoes' },
      path: '/meus-dados/comissoes',
      redirect: false,
    });
    expect(resolveSalesOpsRoute({ workspace: 'meus-dados', view: 'vendas' }, finder)).toEqual({
      route: { workspace: 'meus-dados', view: 'vendas' },
      path: '/meus-dados/vendas',
      redirect: false,
    });
  });

  it('redirects routes pointing at an invisible or forbidden target to the role default', () => {
    expect(resolveSalesOpsRoute({ workspace: 'tatico', view: 'dashboard' }, seller)).toEqual({
      route: { workspace: 'meus-dados', view: 'vendedores' },
      path: '/meus-dados/vendedores',
      redirect: true,
    });
    expect(resolveSalesOpsRoute({ workspace: 'cadastros', view: 'produtos' }, seller)).toEqual({
      route: { workspace: 'meus-dados', view: 'vendedores' },
      path: '/meus-dados/vendedores',
      redirect: true,
    });
    expect(resolveSalesOpsRoute({ workspace: 'operacional', view: 'vendas' }, finder)).toEqual({
      route: { workspace: 'meus-dados', view: 'finders' },
      path: '/meus-dados/finders',
      redirect: true,
    });
    expect(resolveSalesOpsRoute({ workspace: 'meus-dados', view: 'vendedores' }, team)).toEqual({
      route: { workspace: 'tatico', view: 'dashboard' },
      path: '/tatico/dashboard',
      redirect: true,
    });
    expect(resolveSalesOpsRoute({ workspace: 'meus-dados', view: 'finders' }, seller)).toEqual({
      route: { workspace: 'meus-dados', view: 'vendedores' },
      path: '/meus-dados/vendedores',
      redirect: true,
    });
    expect(resolveSalesOpsRoute({}, team)).toEqual({
      route: { workspace: 'tatico', view: 'dashboard' },
      path: '/tatico/dashboard',
      redirect: true,
    });
    expect(resolveSalesOpsRoute({ workspace: 'unknown', view: 'vendas' }, seller)).toEqual({
      route: { workspace: 'meus-dados', view: 'vendedores' },
      path: '/meus-dados/vendedores',
      redirect: true,
    });
  });

  it('maps a view to its workspace within the visible set, team taking precedence', () => {
    expect(workspaceForView('produtos', team)).toBe('cadastros');
    expect(workspaceForView('vendas', team)).toBe('operacional');
    expect(workspaceForView('dashboard', team)).toBe('tatico');
    expect(workspaceForView('vendedores', seller)).toBe('meus-dados');
    expect(workspaceForView('comissoes', seller)).toBe('meus-dados');
    expect(workspaceForView('finders', finder)).toBe('meus-dados');
    expect(workspaceForView('vendas', finder)).toBe('meus-dados');
    expect(workspaceForView('vendedores', ['admin', 'seller'])).toBe('tatico');
    expect(workspaceForView('vendas', ['admin', 'finder'])).toBe('operacional');
  });

  it('builds canonical paths', () => {
    expect(buildSalesOpsPath({ workspace: 'tatico', view: 'dashboard' })).toBe('/tatico/dashboard');
    expect(buildSalesOpsPath({ workspace: 'meus-dados', view: 'comissoes' })).toBe(
      '/meus-dados/comissoes',
    );
  });
});
```

Run the primary oracle now and confirm it fails (RED) because the current model is single-role and has no `meus-dados` or `getVisibleWorkspaces`.

### Step 2 (GREEN): rewrite `apps/web/src/sales-ops/navigation.ts`

Replace the whole file with the following.
It removes `SalesOpsRoleView` and `getSalesOpsRoleViews`, adds `meus-dados`, and re-keys every function on `readonly AppRole[]`.

```ts
import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  Cog,
  ContactRound,
  Database,
  Search,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { AppRole } from '@/auth/claims';

export type SalesOpsWorkspace = 'tatico' | 'operacional' | 'cadastros' | 'meus-dados';
export type SalesOpsView =
  | 'dashboard'
  | 'vendas'
  | 'vendedores'
  | 'finders'
  | 'comissoes'
  | 'produtos'
  | 'clientes'
  | 'geral';

export type SalesOpsNavigationItem = {
  id: SalesOpsView;
  label: string;
  icon: LucideIcon;
};

export type SalesOpsRoute = Readonly<{
  workspace: SalesOpsWorkspace;
  view: SalesOpsView;
}>;

export type SalesOpsRouteParams = Readonly<{
  workspace?: string;
  view?: string;
}>;

export type SalesOpsRouteResolution = Readonly<{
  route: SalesOpsRoute;
  path: string;
  redirect: boolean;
}>;

const tacticalTeam: SalesOpsNavigationItem[] = [
  { id: 'dashboard', label: 'Visão geral', icon: BarChart3 },
  { id: 'vendedores', label: 'Vendedores', icon: UsersRound },
  { id: 'finders', label: 'Finders', icon: Search },
];

const operational: SalesOpsNavigationItem[] = [
  { id: 'vendas', label: 'Vendas', icon: BriefcaseBusiness },
  { id: 'comissoes', label: 'Comissões', icon: BadgeDollarSign },
];

const cadastros: SalesOpsNavigationItem[] = [
  { id: 'produtos', label: 'Produtos', icon: Database },
  { id: 'clientes', label: 'Clientes', icon: ContactRound },
  { id: 'geral', label: 'Geral', icon: Cog },
];

const meusDadosSeller: SalesOpsNavigationItem[] = [
  { id: 'vendedores', label: 'Meu painel', icon: UsersRound },
  { id: 'comissoes', label: 'Comissões', icon: BadgeDollarSign },
];

const meusDadosFinder: SalesOpsNavigationItem[] = [
  { id: 'finders', label: 'Meu painel', icon: Search },
  { id: 'vendas', label: 'Indicações', icon: BriefcaseBusiness },
];

export const salesOpsWorkspaces: Array<{
  id: SalesOpsWorkspace;
  label: string;
  description: string;
}> = [
  { id: 'tatico', label: 'Tático', description: 'Indicadores e painéis' },
  { id: 'operacional', label: 'Operacional', description: 'Vendas e conferência' },
  { id: 'cadastros', label: 'Cadastros', description: 'Catálogo e regras' },
  { id: 'meus-dados', label: 'Meus dados', description: 'Painel e comissões pessoais' },
];

export function getVisibleWorkspaces(roles: readonly AppRole[]): SalesOpsWorkspace[] {
  const roleSet = new Set(roles);
  const visible: SalesOpsWorkspace[] = [];
  if (roleSet.has('admin')) {
    visible.push('tatico', 'operacional', 'cadastros');
  }
  if (roleSet.has('seller') || roleSet.has('finder')) {
    visible.push('meus-dados');
  }
  return visible;
}

export function getSalesOpsNavigation(
  workspace: SalesOpsWorkspace,
  roles: readonly AppRole[],
): SalesOpsNavigationItem[] {
  switch (workspace) {
    case 'tatico':
      return tacticalTeam;
    case 'operacional':
      return operational;
    case 'cadastros':
      return cadastros;
    case 'meus-dados': {
      const roleSet = new Set(roles);
      const items: SalesOpsNavigationItem[] = [];
      if (roleSet.has('seller')) items.push(...meusDadosSeller);
      if (roleSet.has('finder')) items.push(...meusDadosFinder);
      return items;
    }
  }
}

export function buildSalesOpsPath(route: SalesOpsRoute): string {
  return `/${route.workspace}/${route.view}`;
}

export function getDefaultSalesOpsRoute(
  roles: readonly AppRole[],
  preferredWorkspace?: SalesOpsWorkspace,
): SalesOpsRoute {
  const visible = getVisibleWorkspaces(roles);

  if (preferredWorkspace && visible.includes(preferredWorkspace)) {
    const preferredView = getSalesOpsNavigation(preferredWorkspace, roles)[0]?.id;
    if (preferredView) return { workspace: preferredWorkspace, view: preferredView };
  }

  const workspace = visible[0];
  if (workspace) {
    const view = getSalesOpsNavigation(workspace, roles)[0]?.id;
    if (view) return { workspace, view };
  }

  return { workspace: 'tatico', view: 'dashboard' };
}

export function resolveSalesOpsRoute(
  params: SalesOpsRouteParams,
  roles: readonly AppRole[],
): SalesOpsRouteResolution {
  const workspace = getVisibleWorkspaces(roles).find((id) => id === params.workspace);
  const view = workspace
    ? getSalesOpsNavigation(workspace, roles).find((item) => item.id === params.view)?.id
    : undefined;

  if (workspace && view) {
    const route = { workspace, view };
    return { route, path: buildSalesOpsPath(route), redirect: false };
  }

  const route = getDefaultSalesOpsRoute(roles);
  return { route, path: buildSalesOpsPath(route), redirect: true };
}

export function workspaceForView(
  view: SalesOpsView,
  roles: readonly AppRole[],
): SalesOpsWorkspace {
  for (const workspace of getVisibleWorkspaces(roles)) {
    if (getSalesOpsNavigation(workspace, roles).some((item) => item.id === view)) {
      return workspace;
    }
  }
  return getDefaultSalesOpsRoute(roles).workspace;
}
```

Notes on this file:
The `switch` over `SalesOpsWorkspace` has no `default`, so adding any future workspace id is a compile error until handled (exhaustiveness).
Team workspaces (`tatico`/`operacional`/`cadastros`) return fixed team content because `getVisibleWorkspaces` only ever exposes them to `admin`.
For a dual-role user, shared view ids (`vendedores`, `vendas`, `comissoes`, `finders`) resolve to the team workspace first because `getVisibleWorkspaces` lists team workspaces before `meus-dados`.

Run the primary oracle again and confirm it is GREEN.

### Step 3: wire `apps/web/src/sales-ops/SalesOpsApp.tsx` to the new model and remove the switcher

3a. Imports.
In the `lucide-react` import block (lines 1-22) `UserRound` is already imported; keep it (it is the meus-dados icon).
In the `./navigation` import block (lines 52-63) remove `getSalesOpsRoleViews` and `type SalesOpsRoleView`, and add `getVisibleWorkspaces`.
Add a new import near the other `@/auth` import: `import type { AppRole } from '@/auth/claims';`.

3b. `workspaceVisuals` map (lines 114-125): add the `meus-dados` entry so the record stays exhaustive over `SalesOpsWorkspace`.

```tsx
const workspaceVisuals: Record<
  SalesOpsWorkspace,
  {
    icon: typeof LayoutGrid;
    tileBg: string;
    tileColor: string;
  }
> = {
  tatico: { icon: LayoutGrid, tileBg: '#eaa81a', tileColor: '#18181b' },
  operacional: { icon: ListChecks, tileBg: '#3f7cc4', tileColor: '#fff' },
  cadastros: { icon: Settings, tileBg: '#5a9166', tileColor: '#fff' },
  'meus-dados': { icon: UserRound, tileBg: '#8a5cc4', tileColor: '#fff' },
};
```

3c. Re-key `titleForView` (lines 133-169) on `workspace` and add a `roleSummaryLabel` helper.
Replace the `titleForView` signature and the three role-dependent titles.
Personal titles apply only under `meus-dados`.

```tsx
function titleForView(view: SalesOpsView, workspace: SalesOpsWorkspace) {
  const personal = workspace === 'meus-dados';
  const map: Record<SalesOpsView, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Visão geral',
      subtitle: 'Receita, recorrência, comissões e ranking do mês',
    },
    vendas: {
      title: personal ? 'Minhas indicações' : 'Vendas',
      subtitle: 'Registro operacional com código, cliente, produto, responsável e status',
    },
    vendedores: {
      title: personal ? 'Meu painel' : 'Vendedores',
      subtitle: 'Performance, comissão, ticket médio e vendas por responsável',
    },
    finders: {
      title: personal ? 'Meu painel' : 'Finders',
      subtitle: 'Indicações, receita gerada e comissão por parceiro',
    },
    comissoes: {
      title: personal ? 'Minhas comissões' : 'Comissões',
      subtitle: 'Contas a pagar geradas pelas vendas persistidas',
    },
    produtos: {
      title: 'Produtos',
      subtitle: 'Catálogo, valores, códigos e regras de comissão',
    },
    clientes: {
      title: 'Clientes',
      subtitle: 'Base comercial e receita acumulada por cliente',
    },
    geral: {
      title: 'Geral',
      subtitle: 'Empresa, comissão padrão, financeiro e preferências',
    },
  };
  return map[view];
}

function roleSummaryLabel(roles: readonly AppRole[]): string {
  const roleSet = new Set(roles);
  const parts: string[] = [];
  if (roleSet.has('admin')) parts.push('Equipe');
  if (roleSet.has('seller')) parts.push('Vendedor');
  if (roleSet.has('finder')) parts.push('Finder');
  return parts.join(' · ');
}
```

3d. Component state and derived values (lines 471-500).
Remove the `roleMenuOpen`/`setRoleMenuOpen` state (line 473) and the `selectedRoleView`/`setSelectedRoleView` state (line 474).
Remove `availableRoleViews`, `roleView`, `activeRoleView` (lines 479-484).
Rewrite the derived block as:

```tsx
const visibleWorkspaceIds = useMemo(
  () => getVisibleWorkspaces(profile.roles),
  [profile.roles],
);
const resolution = resolveSalesOpsRoute(routeParams, profile.roles);
const { workspace, view } = resolution.route;
const bootstrap = bootstrapQuery.data ?? emptyBootstrap;
const dashboard = useMemo(() => buildDashboardModel(bootstrap), [bootstrap]);
const navItems = getSalesOpsNavigation(workspace, profile.roles);
const title = titleForView(view, workspace);
const payableBrl = bootstrap.payables
  .filter((payable) => payable.status === 'open')
  .reduce((sum, payable) => sum + payable.amountBrl, 0);
const roleLabel = roleSummaryLabel(profile.roles);
const userName = profile.name ?? 'FXL';
```

3e. `setWorkspace` (lines 502-505): use `profile.roles`.

```tsx
function setWorkspace(next: SalesOpsWorkspace) {
  setWorkspaceMenuOpen(false);
  navigate(buildSalesOpsPath(getDefaultSalesOpsRoute(profile.roles, next)));
}
```

3f. Delete `setRole` entirely (lines 507-515).

3g. `go` (lines 517-522): prefer the current workspace when it already contains the view, so a dual-role user never jumps out of `meus-dados` on a sidebar click; cross-workspace links (dashboard "Ver todas") still resolve through `workspaceForView`.

```tsx
function go(next: SalesOpsView) {
  setWorkspaceMenuOpen(false);
  const targetWorkspace = navItems.some((item) => item.id === next)
    ? workspace
    : workspaceForView(next, profile.roles);
  navigate(buildSalesOpsPath({ workspace: targetWorkspace, view: next }));
}
```

3h. `availableWorkspaces` (lines 556-558): drive off the visibility rule and keep the catalogue order (`tatico`, `operacional`, `cadastros`, `meus-dados`).

```tsx
const availableWorkspaces = salesOpsWorkspaces.filter((item) =>
  visibleWorkspaceIds.includes(item.id),
);
```

3i. Delete `roleOptions` entirely (lines 562-593).

3j. No-role guard (lines 595-597): base it on the visibility rule.

```tsx
if (visibleWorkspaceIds.length === 0) {
  return <Navigate to="/no-role" replace />;
}
```

Keep the immediately following `if (resolution.redirect) { return <Navigate to={resolution.path} replace />; }` unchanged, and keep this guard ordered before it (same order as today).

3k. Sidebar commissions badge (lines 758-769): the open-payables count is a team operations indicator, so gate it on the operational workspace instead of the removed `activeRoleView === 'equipe'`.
Change the condition `activeRoleView === 'equipe'` (line 760) to `workspace === 'operacional'`.
The rest of the badge block is unchanged.

3l. Header identity block (lines 822-886): remove the interactive switcher (the `button[title="Trocar visualização"]` trigger, the `ChevronDown`, and the whole `roleMenuOpen` dropdown that renders "Nível de visualização"), and keep a static, non-interactive identity display with the same avatar styling.
Replace the entire `<div className="relative hidden lg:block"> ... </div>` (lines 822-886) with:

```tsx
<div className="hidden items-center gap-2 py-1 pl-1 pr-2 lg:flex">
  <span className="sales-ops-num flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#eaa81a] to-[#9c7210] text-[15px] font-bold text-white">
    {initials(userName)}
  </span>
  <span className="min-w-0 text-left leading-tight">
    <span className="block max-w-[150px] truncate text-sm font-bold">{userName}</span>
    <span className="block text-xs text-[#8b8b92]">{roleLabel}</span>
  </span>
</div>
```

After this step, confirm there are no remaining references to `activeRoleView`, `roleView`, `selectedRoleView`, `roleMenuOpen`, `getSalesOpsRoleViews`, `SalesOpsRoleView`, `setRole`, or `roleOptions` in the file, and that `initials`, `useMemo`, and `Navigate` are still imported and used.

### Step 4: update `apps/web/src/sales-ops/__tests__/routing.test.tsx`

This component test currently drives the removed switcher and the old seller/finder routes, so it must be updated for the new model.

4a. Delete the now-unused helpers `roleOptionByIdentity` (lines 163-172) and `roleButton` (lines 180-184).

4b. Keep unchanged: the test "renders a canonical deep link and drives shell navigation through the URL", the test "restores the visible workspace and page through browser history", and the test "navigates from the dashboard sales card to operational sales" (all use `['admin']`).

4c. Rewrite the test "replaces invalid and role-forbidden routes with the role default" (lines 252-264) so seller and finder land in `meus-dados`:

```tsx
it('replaces invalid and role-forbidden routes with the role default', async () => {
  await renderRoute('/', ['admin']);
  expect(pathname()).toBe('/tatico/dashboard');
  expectHeading('Visão geral');

  await renderRoute('/cadastros/produtos', ['seller']);
  expect(pathname()).toBe('/meus-dados/vendedores');
  expectWorkspace('Meus dados');
  expectHeading('Meu painel');

  await renderRoute('/operacional/vendas', ['finder']);
  expect(pathname()).toBe('/meus-dados/finders');
  expectWorkspace('Meus dados');
  expectHeading('Meu painel');
});
```

4d. Rewrite the test "does not restore a role-forbidden route after canonical replacement" (lines 266-275) to the new model, keeping its intent (a forbidden entry that was canonically replaced is not restored by Back):

```tsx
it('does not restore a role-forbidden route after canonical replacement', async () => {
  await renderHistory(['/meus-dados/vendas', '/cadastros/produtos'], ['finder']);
  expect(pathname()).toBe('/meus-dados/finders');
  expectHeading('Meu painel');

  await click(buttonByText('Back'));
  expect(pathname()).toBe('/meus-dados/vendas');
  expectHeading('Minhas indicações');
  expectWorkspace('Meus dados');
});
```

4e. Delete the test "preserves or replaces the route when the active role changes" (lines 277-290) and the test "does not restore forbidden Cadastros after a role-switch replacement" (lines 292-304); both exercise the removed switcher.

4f. Add three tests covering the new visibility and the switcher removal:

```tsx
it('lands seller-only users in Meus dados and blocks team workspaces', async () => {
  await renderRoute('/', ['seller']);
  expect(pathname()).toBe('/meus-dados/vendedores');
  expectWorkspace('Meus dados');
  expectHeading('Meu painel');

  await renderRoute('/operacional/vendas', ['seller']);
  expect(pathname()).toBe('/meus-dados/vendedores');
});

it('no longer renders the viewing-level switcher', async () => {
  await renderRoute('/tatico/dashboard', ['admin', 'seller', 'finder']);
  expect(container.querySelector('button[title="Trocar visualização"]')).toBeNull();
  expect(container.textContent).not.toContain('Nível de visualização');
});

it('shows all four workspaces for team plus personal roles', async () => {
  await renderRoute('/tatico/dashboard', ['admin', 'seller', 'finder']);
  await click(workspaceButton());
  buttonByText('Tático');
  buttonByText('Operacional');
  buttonByText('Cadastros');
  buttonByText('Meus dados');
});
```

`buttonByText` throws when a label is missing, so the last test asserts all four menu entries exist.

Run `pnpm --filter @fxl-sales/web test src/sales-ops/__tests__/routing.test.tsx` and confirm GREEN.

Note for the executor: the exact helper names in `routing.test.tsx` (`renderRoute`, `renderHistory`, `buttonByText`, `workspaceButton`, `expectHeading`, `expectWorkspace`, `pathname`, `container`, `click`) must be read from the current file and matched; if a helper signature differs (for example the role argument shape), adapt the new tests to the file's real helpers rather than assuming these signatures. The intent per test is the contract, not the exact helper call.

### Step 5 (refactor and guards)

Run `pnpm --filter @fxl-sales/web type-check` to prove the exhaustive `switch`, the `Record<SalesOpsWorkspace, ...>` maps, and the removed symbols leave no type errors.
Run `pnpm --filter @fxl-sales/web lint` to catch any now-unused imports or helpers.
Run the full `pnpm --filter @fxl-sales/web test` once to confirm the whole Sales Ops suite is GREEN.
Do not touch the open-price `productNameSnapshot` behavior (`salePrimaryProductName`, lines 239-244) or any view component body.

## New model summary

| Role set (`AppRole[]`) | Visible workspaces (in order) | Default route |
| --- | --- | --- |
| `['admin']` | `tatico`, `operacional`, `cadastros` | `/tatico/dashboard` |
| `['seller']` | `meus-dados` | `/meus-dados/vendedores` |
| `['finder']` | `meus-dados` | `/meus-dados/finders` |
| `['seller','finder']` | `meus-dados` | `/meus-dados/vendedores` |
| `['admin','seller']` | `tatico`, `operacional`, `cadastros`, `meus-dados` | `/tatico/dashboard` |
| `['admin','seller','finder']` | `tatico`, `operacional`, `cadastros`, `meus-dados` | `/tatico/dashboard` |
| `[]` | none | redirect to `/no-role` |

`meus-dados` navigation per personal role: seller → `Meu painel` (`vendedores`) + `Comissões` (`comissoes`); finder → `Meu painel` (`finders`) + `Indicações` (`vendas`); both → the seller pair followed by the finder pair.

## Notes

Team-only users never see `meus-dados`, because `getVisibleWorkspaces` only pushes it when the role set holds `seller` or `finder`.
Seller-only and finder-only users see only `meus-dados`, and both their default route and any URL aimed at a team workspace resolve into `meus-dados`.
A URL pointing at a workspace the user cannot see (for example a seller hitting `/tatico/dashboard`, or a team user hitting `/meus-dados/vendedores`) is not found in `getVisibleWorkspaces`, so `resolveSalesOpsRoute` returns `redirect: true` to the user's default and the component issues `<Navigate replace>`; the URL stays the single source of truth.
Multi-role users get the union of their personal items in `meus-dados`, and shared view ids resolve to the team workspace first because team workspaces precede `meus-dados` in `getVisibleWorkspaces`; the `go` change ("prefer current workspace") keeps a dual-role user inside `meus-dados` when they click a personal nav item.
The two `Meu painel` entries a seller+finder sees in `meus-dados` are distinct views (`vendedores` with `UsersRound`, `finders` with `Search`), consistent with how the team `tatico` nav already distinguishes Vendedores from Finders.
Zero recognized roles keeps the existing `/no-role` behavior, now expressed as `visibleWorkspaceIds.length === 0` (equivalent to the removed `!roleView`, since every recognized role grants at least one workspace).
The legacy `/admin/*`, `/finder/*`, `/seller/*`, and `/no-role` route trees are untouched; this slice only changes the canonical Sales Ops navigation model and its single consumer.
`routing.test.tsx` is in `files_modified` even though the primary oracle is `navigation.test.ts`, because the component test exercises the removed switcher and the old seller/finder routes and would otherwise leave the suite RED; the frontmatter list reflects that reality.
No raw ids are rendered: workspace labels come from `salesOpsWorkspaces`, and the header shows `profile.name` (falling back to `FXL`) plus a human role summary, never an id.
