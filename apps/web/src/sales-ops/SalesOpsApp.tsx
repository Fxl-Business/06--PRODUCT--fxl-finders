import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Edit3,
  Filter,
  Loader2,
  LogOut,
  Plus,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useAuthProfile, useLogout } from '@/auth/react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCreateSalesOpsSale,
  useSalesOpsBootstrap,
  useSaveSalesOpsClient,
  useSaveSalesOpsPerson,
  useSaveSalesOpsProduct,
  useSaveSalesOpsSettings,
} from './hooks';
import {
  getSalesOpsNavigation,
  resolveInitialSalesOpsView,
  salesOpsWorkspaces,
  workspaceForView,
  type SalesOpsRoleView,
  type SalesOpsView,
  type SalesOpsWorkspace,
} from './navigation';
import type {
  CreateSalePayload,
  PaymentCondition,
  PaymentMethod,
  SaleDraft,
  SalesOpsBootstrap,
  SalesOpsClient,
  SalesOpsPerson,
  SalesOpsProduct,
  SalesOpsSettings,
  SalesOpsStatus,
} from './types';
import { buildDashboardModel, buildSalePayload, formatMoneyBrl, initials } from './calculations';
import type {
  SaveClientPayload,
  SavePersonPayload,
  SaveProductPayload,
  SaveSettingsPayload,
} from './api';

const emptyBootstrap: SalesOpsBootstrap = {
  sales: [],
  products: [],
  clients: [],
  people: [],
  payables: [],
  saleItems: [],
  settings: null,
};

const panelClass = 'rounded-[18px] border border-[#e8e8ec] bg-white';
const mutedPanelClass = 'rounded-[18px] border border-[#e8e8ec] bg-[#fbfbfc]';
const tableHeadClass =
  'px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9b9ba3]';
const tableCellClass = 'px-4 py-3 text-[13.5px] text-[#57575f]';
const iconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-[9px] border border-[#dcdce2] bg-white text-[#57575f] transition hover:border-[#eaa81a] hover:bg-[#f5f2ea] hover:text-[#9c7210]';

type ModalState =
  | { kind: 'product'; product?: SalesOpsProduct }
  | { kind: 'client'; client?: SalesOpsClient }
  | { kind: 'person'; person?: SalesOpsPerson; roleHint: 'seller' | 'finder' | 'collaborator' }
  | null;

function roleFromProfile(role?: string): SalesOpsRoleView {
  if (role === 'seller') return 'vendedor';
  if (role === 'finder') return 'finder';
  return 'equipe';
}

function titleForView(view: SalesOpsView, role: SalesOpsRoleView) {
  const map: Record<SalesOpsView, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Visão geral',
      subtitle: 'Receita, recorrência, comissões e ranking do mês',
    },
    vendas: {
      title: role === 'finder' ? 'Minhas indicações' : role === 'vendedor' ? 'Minhas vendas' : 'Vendas',
      subtitle: 'Registro operacional com código, cliente, produto, responsável e status',
    },
    vendedores: {
      title: role === 'vendedor' ? 'Meu painel' : 'Vendedores',
      subtitle: 'Performance, comissão, ticket médio e vendas por responsável',
    },
    finders: {
      title: role === 'finder' ? 'Meu painel' : 'Finders',
      subtitle: 'Indicações, receita gerada e comissão por parceiro',
    },
    comissoes: {
      title: role === 'equipe' ? 'Comissões' : 'Minhas comissões',
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

function statusMeta(status: SalesOpsStatus) {
  const map: Record<SalesOpsStatus, { label: string; className: string }> = {
    draft: { label: 'Rascunho', className: 'bg-[#e9e9ed] text-[#6a6a72]' },
    forecast: { label: 'Previsto', className: 'bg-[#e9e9ed] text-[#6a6a72]' },
    closed: { label: 'Fechado', className: 'bg-[#f7e2a8] text-[#7a5a12]' },
    in_progress: { label: 'Em andamento', className: 'bg-[#d3e3f6] text-[#2664ad]' },
    completed: { label: 'Concluído', className: 'bg-[#c9e7cf] text-[#1f7d43]' },
    cancelled: { label: 'Cancelado', className: 'bg-[#f6d1c5] text-[#a5341c]' },
  };
  return map[status];
}

function payableTypeMeta(kind: string) {
  if (kind === 'seller_commission') return { label: 'Vendedor', className: 'bg-[#fdf0cf] text-[#7a5a12]' };
  if (kind === 'finder_commission') return { label: 'Finder', className: 'bg-[#d3e3f6] text-[#2664ad]' };
  if (kind === 'professional_cost') return { label: 'Prestador', className: 'bg-[#eeeef1] text-[#57575f]' };
  if (kind === 'tax') return { label: 'Imposto', className: 'bg-[#f6d1c5] text-[#a5341c]' };
  return { label: 'Custo', className: 'bg-[#eeeef1] text-[#57575f]' };
}

function conditionLabel(condition: PaymentCondition, installments: number) {
  if (condition === 'cash') return 'À vista';
  if (condition === 'recurring') return 'Recorrente';
  return `${installments}x`;
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function displayDate(value: string) {
  const iso = dateOnly(value);
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function inputDateToday() {
  return new Date().toISOString().slice(0, 10);
}

function parseCurrencyToCents(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function centsToInput(cents: number | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

function parseDecimal(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (!value) return fallback;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pctToInput(value: string | number | undefined, fallback = 0): string {
  return String(parseDecimal(value, fallback));
}

function salePrimaryProductName(bootstrap: SalesOpsBootstrap, saleId: string): string {
  return (
    bootstrap.saleItems.find((item) => item.saleId === saleId)?.productNameSnapshot ??
    'Sem produto'
  );
}

function salesForPerson(bootstrap: SalesOpsBootstrap, person: SalesOpsPerson, mode: 'seller' | 'finder') {
  return bootstrap.sales.filter((sale) => {
    if (mode === 'seller') {
      return sale.sellerPersonId === person.id || sale.sellerNameSnapshot === person.displayName;
    }
    return sale.finderPersonId === person.id || sale.finderNameSnapshot === person.displayName;
  });
}

function personMetrics(bootstrap: SalesOpsBootstrap, person: SalesOpsPerson, mode: 'seller' | 'finder') {
  const sales = salesForPerson(bootstrap, person, mode).filter((sale) => sale.status !== 'cancelled');
  const totalBrl = sales.reduce((sum, sale) => sum + sale.totalBrl, 0);
  const commissionBrl = sales.reduce(
    (sum, sale) =>
      sum + (mode === 'seller' ? sale.sellerCommissionBrl : sale.finderCommissionBrl),
    0,
  );
  return {
    sales,
    totalBrl,
    commissionBrl,
    ticketBrl: sales.length > 0 ? Math.round(totalBrl / sales.length) : 0,
  };
}

function activeSettings(settings: SalesOpsSettings | null): SaveSettingsPayload {
  return {
    legalName: settings?.legalName ?? '',
    document: settings?.document ?? '',
    phone: settings?.phone ?? '',
    financeEmail: settings?.financeEmail ?? '',
    defaultSellerCommissionPct: parseDecimal(settings?.defaultSellerCommissionPct, 10),
    defaultFinderCommissionPct: parseDecimal(settings?.defaultFinderCommissionPct, 3),
    defaultTaxPct: parseDecimal(settings?.defaultTaxPct, 6),
    currency: settings?.currency ?? 'BRL',
    taxRegime: settings?.taxRegime ?? 'Simples Nacional',
    periodClosingDay: settings?.periodClosingDay ?? 1,
    tableDensity: settings?.tableDensity ?? 'comfortable',
    dateFormat: settings?.dateFormat ?? 'dd/mm/aaaa',
    language: settings?.language ?? 'pt-BR',
    commissionOnRecurring: settings?.commissionOnRecurring ?? true,
    sellerCanBeFinder: settings?.sellerCanBeFinder ?? true,
  };
}

function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[11px] bg-[#201f24] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-[#33333a] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function AccentButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[13px] bg-[#eaa81a] px-4 py-2 text-[13.5px] font-bold text-[#18181b] transition hover:bg-[#f3b634] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[11px] border border-[#dcdce2] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#57575f] transition hover:bg-[#f2f2f4] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-xs font-semibold text-[#8b8b92]">
        {label}
        {required ? <span className="text-[#b23a22]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
  className = '',
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={`h-10 rounded-md border border-[#dcdce2] bg-[#fafafb] px-3 text-sm font-medium text-[#201f24] outline-none transition focus:border-[#eaa81a] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      className="flex items-center justify-between gap-4 rounded-[11px] border border-[#ececf1] bg-[#fafafb] px-4 py-3 text-left"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-[#201f24]">{label}</span>
        {description ? <span className="block text-xs text-[#8b8b92]">{description}</span> : null}
      </span>
      <span
        className={`relative h-[25px] w-11 flex-none rounded-full transition ${checked ? 'bg-[#2f7d4b]' : 'bg-[#d2d2d8]'}`}
      >
        <span
          className={`absolute top-[2.5px] h-5 w-5 rounded-full bg-white transition ${checked ? 'right-[2.5px]' : 'left-[2.5px]'}`}
        />
      </span>
    </button>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className={`${mutedPanelClass} flex min-h-[154px] flex-col items-center justify-center gap-2 p-6 text-center`}>
      <div className="text-sm font-bold text-[#201f24]">{title}</div>
      <div className="max-w-[420px] text-[13px] leading-5 text-[#8b8b92]">{text}</div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-[14px] border border-[#e8e8ec] bg-white px-5 py-4 text-sm font-semibold text-[#57575f]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando dados comerciais
      </div>
    </div>
  );
}

export function SalesOpsApp() {
  const profile = useAuthProfile();
  const logout = useLogout();
  const bootstrapQuery = useSalesOpsBootstrap();
  const savePerson = useSaveSalesOpsPerson();
  const saveProduct = useSaveSalesOpsProduct();
  const saveClient = useSaveSalesOpsClient();
  const createSale = useCreateSalesOpsSale();
  const saveSettings = useSaveSalesOpsSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRoleView, setSelectedRoleView] = useState<SalesOpsRoleView | null>(null);
  const [workspaceState, setWorkspaceState] = useState<SalesOpsWorkspace>('tatico');
  const [viewState, setViewState] = useState<SalesOpsView>('dashboard');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [saleWizardOpen, setSaleWizardOpen] = useState(false);

  const roleView = selectedRoleView ?? roleFromProfile(profile.role);
  const workspace: SalesOpsWorkspace =
    workspaceState === 'config' && roleView !== 'equipe' ? 'tatico' : workspaceState;
  const view = resolveInitialSalesOpsView(workspace, roleView, viewState);
  const bootstrap = bootstrapQuery.data ?? emptyBootstrap;
  const dashboard = useMemo(() => buildDashboardModel(bootstrap), [bootstrap]);
  const navItems = getSalesOpsNavigation(workspace, roleView);
  const title = titleForView(view, roleView);
  const payableBrl = bootstrap.payables
    .filter((payable) => payable.status === 'open')
    .reduce((sum, payable) => sum + payable.amountBrl, 0);
  const roleLabel =
    roleView === 'equipe' ? 'Equipe · Admin' : roleView === 'vendedor' ? 'Vendedor' : 'Finder';
  const userName = profile.name ?? (roleView === 'finder' ? 'Finder' : 'FXL');

  function setWorkspace(next: SalesOpsWorkspace) {
    setWorkspaceState(next);
    setViewState((current) => resolveInitialSalesOpsView(next, roleView, current));
  }

  function setRole(next: SalesOpsRoleView) {
    const nextWorkspace = next === 'equipe' ? workspace : workspace === 'config' ? 'tatico' : workspace;
    setSelectedRoleView(next);
    setWorkspaceState(nextWorkspace);
    setViewState((current) => resolveInitialSalesOpsView(nextWorkspace, next, current));
  }

  function go(next: SalesOpsView) {
    setWorkspaceState(workspaceForView(next, roleView));
    setViewState(next);
  }

  function runHeaderAction() {
    if (view === 'produtos') {
      setModal({ kind: 'product' });
      return;
    }
    if (view === 'clientes') {
      setModal({ kind: 'client' });
      return;
    }
    if (view === 'vendedores') {
      setModal({ kind: 'person', roleHint: 'seller' });
      return;
    }
    if (view === 'finders') {
      setModal({ kind: 'person', roleHint: 'finder' });
      return;
    }
    setSaleWizardOpen(true);
  }

  const headerAction =
    view === 'geral'
      ? null
      : view === 'produtos'
        ? 'Novo produto'
        : view === 'clientes'
          ? 'Novo cliente'
          : view === 'vendedores'
            ? 'Novo vendedor'
            : view === 'finders'
              ? 'Novo finder'
              : 'Nova venda';

  return (
    <div className="sales-ops flex h-screen w-full gap-0 bg-[#e8e8eb] p-[10px] text-[#201f24]">
      <aside
        className={`flex flex-none flex-col overflow-hidden rounded-[20px] bg-[#18181b] px-4 py-[22px] transition-all duration-200 ${sidebarCollapsed ? 'w-[76px]' : 'w-[244px]'}`}
      >
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-[11px] px-1 pb-4'}`}>
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[#eaa81a]">
            <CircleDollarSign className="h-[19px] w-[19px] text-[#18181b]" />
          </div>
          {!sidebarCollapsed ? (
            <>
              <div className="min-w-0 flex-1 leading-none">
                <div className="sales-ops-num text-[19px] font-bold text-[#f3f3f5]">FXL</div>
                <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8b8b92]">
                  Vendas
                </div>
              </div>
              <button
                aria-label="Recolher menu"
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-[#343439] bg-[#242428] text-[#8b8b92] transition hover:bg-[#2c2c31]"
                onClick={() => setSidebarCollapsed(true)}
                type="button"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              aria-label="Expandir menu"
              className="mt-12 flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#343439] bg-[#242428] text-[#a2a2aa] transition hover:bg-[#2c2c31] hover:text-[#eaa81a]"
              onClick={() => setSidebarCollapsed(false)}
              type="button"
            >
              <ChevronsRight className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>

        <div className="mt-1 flex flex-col gap-2">
          {!sidebarCollapsed ? (
            <>
              <div className="rounded-[14px] border border-[#343439] bg-[#242428] p-2">
                <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b8b92]">
                  Workspace
                </div>
                <div className="grid gap-1">
                  {salesOpsWorkspaces
                    .filter((item) => roleView === 'equipe' || item.id !== 'config')
                    .map((item) => (
                      <button
                        className={`rounded-[10px] px-3 py-2 text-left text-[13px] font-bold transition ${
                          workspace === item.id
                            ? 'bg-[#eaa81a] text-[#18181b]'
                            : 'text-[#c9c9d0] hover:bg-[#2c2c31]'
                        }`}
                        key={item.id}
                        onClick={() => setWorkspace(item.id)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                </div>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.id;
                  return (
                    <button
                      className={`flex items-center gap-[13px] rounded-xl px-[13px] py-[11px] text-left text-sm font-semibold transition ${
                        active
                          ? 'bg-[#eaa81a] text-[#18181b]'
                          : 'text-[#c9c9d0] hover:bg-white/5 hover:text-white'
                      }`}
                      key={item.id}
                      onClick={() => go(item.id)}
                      type="button"
                    >
                      <Icon className="h-[18px] w-[18px] flex-none" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </>
          ) : (
            <nav className="mt-5 flex flex-col items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    aria-label={item.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-[11px] transition ${
                      view === item.id
                        ? 'bg-[#eaa81a] text-[#18181b]'
                        : 'text-[#c9c9d0] hover:bg-white/5 hover:text-white'
                    }`}
                    key={item.id}
                    onClick={() => go(item.id)}
                    title={item.label}
                    type="button"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          {!sidebarCollapsed ? (
            <div className="rounded-2xl border border-[#343439] bg-[#242428] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7c7c85]">
                A pagar este mês
              </div>
              <div className="sales-ops-num mt-1 text-[26px] font-bold text-[#f3f3f5]">
                {formatMoneyBrl(payableBrl, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-xs text-[#8b8b92]">
                {bootstrap.payables.filter((item) => item.status === 'open').length} itens em aberto
              </div>
            </div>
          ) : null}
          <AccentButton onClick={() => setSaleWizardOpen(true)}>
            <Plus className="h-4 w-4" />
            {!sidebarCollapsed ? <span>Nova venda</span> : null}
          </AccentButton>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pl-[10px]">
        <header className="flex flex-none items-center gap-4 rounded-t-2xl border border-[#e5e5ea] bg-[#f3f3f5] px-[22px] py-[15px]">
          <div className="min-w-0">
            <h1 className="sales-ops-num text-[23px] font-bold tracking-normal text-[#201f24]">
              {title.title}
            </h1>
            <div className="mt-0.5 text-[12.5px] text-[#8b8b92]">{title.subtitle}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {headerAction ? (
              <AccentButton onClick={runHeaderAction}>
                <Plus className="h-[15px] w-[15px]" />
                {headerAction}
              </AccentButton>
            ) : null}
            {(view === 'vendas' || view === 'comissoes') ? (
              <SecondaryButton onClick={() => setFiltersOpen((open) => !open)}>
                <Filter className="h-[15px] w-[15px]" />
                Filtros
              </SecondaryButton>
            ) : null}
            <div className="hidden items-center gap-2 rounded-xl border border-[#dcdce2] bg-white px-[14px] py-[9px] text-sm font-semibold text-[#57575f] xl:flex">
              <CalendarDays className="h-[15px] w-[15px] text-[#9c7210]" />
              Julho 2026
            </div>
            <NativeSelect
              className="w-[150px] bg-white"
              onChange={(value) => setRole(value as SalesOpsRoleView)}
              value={roleView}
            >
              <option value="equipe">Equipe</option>
              <option value="vendedor">Vendedor</option>
              <option value="finder">Finder</option>
            </NativeSelect>
            <div className="hidden items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-[#ededf0] lg:flex">
              <div className="sales-ops-num flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#eaa81a] to-[#9c7210] text-[15px] font-bold text-white">
                {initials(userName)}
              </div>
              <div className="leading-tight">
                <div className="max-w-[150px] truncate text-sm font-bold">{userName}</div>
                <div className="text-xs text-[#8b8b92]">{roleLabel}</div>
              </div>
            </div>
            <button
              aria-label="Sair"
              className={iconButtonClass}
              onClick={() => {
                void logout();
              }}
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-2xl border border-t-0 border-[#e5e5ea] bg-[#fafafb]">
          {filtersOpen && (view === 'vendas' || view === 'comissoes') ? (
            <div className="flex flex-none flex-wrap items-center gap-3 border-b border-[#ececf1] bg-white px-[22px] py-[13px]">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#9b9ba3]">
                Filtros
              </span>
              <NativeSelect className="w-[190px]" onChange={() => undefined} value="all">
                <option value="all">Todos os status</option>
              </NativeSelect>
              <NativeSelect className="w-[190px]" onChange={() => undefined} value="all">
                <option value="all">Todos os responsáveis</option>
              </NativeSelect>
              <span className="ml-auto text-[13px] text-[#8b8b92]">
                <span className="sales-ops-num font-bold text-[#201f24]">
                  {view === 'vendas' ? bootstrap.sales.length : bootstrap.payables.length}
                </span>{' '}
                registros
              </span>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-5">
            {bootstrapQuery.isLoading ? <LoadingPanel /> : null}
            {bootstrapQuery.isError ? (
              <EmptyPanel
                text="A API de vendas não respondeu corretamente. Verifique o servidor local e tente novamente."
                title="Não foi possível carregar"
              />
            ) : null}
            {!bootstrapQuery.isLoading && !bootstrapQuery.isError ? (
              <>
                {view === 'dashboard' ? (
                  <DashboardView bootstrap={bootstrap} dashboard={dashboard} go={go} />
                ) : null}
                {view === 'vendas' ? <SalesView bootstrap={bootstrap} /> : null}
                {view === 'vendedores' ? (
                  <PeopleView
                    bootstrap={bootstrap}
                    mode="seller"
                    onEdit={(person) => setModal({ kind: 'person', person, roleHint: 'seller' })}
                  />
                ) : null}
                {view === 'finders' ? (
                  <PeopleView
                    bootstrap={bootstrap}
                    mode="finder"
                    onEdit={(person) => setModal({ kind: 'person', person, roleHint: 'finder' })}
                  />
                ) : null}
                {view === 'comissoes' ? <CommissionsView bootstrap={bootstrap} /> : null}
                {view === 'produtos' ? (
                  <ProductsView
                    products={bootstrap.products}
                    onEdit={(product) => setModal({ kind: 'product', product })}
                  />
                ) : null}
                {view === 'clientes' ? (
                  <ClientsView
                    bootstrap={bootstrap}
                    onEdit={(client) => setModal({ kind: 'client', client })}
                  />
                ) : null}
                {view === 'geral' ? (
                  <SettingsView
                    key={bootstrap.settings?.updatedAt ?? bootstrap.settings?.createdAt ?? 'new'}
                    isSaving={saveSettings.isPending}
                    onSave={(payload) => saveSettings.mutate(payload)}
                    settings={bootstrap.settings}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </main>

      <ProductDialog
        collaborators={bootstrap.people.filter((person) => person.isCollaborator)}
        modal={modal?.kind === 'product' ? modal : null}
        onClose={() => setModal(null)}
        onSave={(payload) => {
          saveProduct.mutate(payload, { onSuccess: () => setModal(null) });
        }}
        saving={saveProduct.isPending}
      />
      <ClientDialog
        modal={modal?.kind === 'client' ? modal : null}
        onClose={() => setModal(null)}
        onSave={(payload) => {
          saveClient.mutate(payload, { onSuccess: () => setModal(null) });
        }}
        saving={saveClient.isPending}
      />
      <PersonDialog
        modal={modal?.kind === 'person' ? modal : null}
        onClose={() => setModal(null)}
        onSave={(payload) => {
          savePerson.mutate(payload, { onSuccess: () => setModal(null) });
        }}
        saving={savePerson.isPending}
      />
      <SaleWizardDialog
        bootstrap={bootstrap}
        onClose={() => setSaleWizardOpen(false)}
        onSave={(payload) => {
          createSale.mutate(payload, {
            onSuccess: () => setSaleWizardOpen(false),
          });
        }}
        open={saleWizardOpen}
        saving={createSale.isPending}
      />
    </div>
  );
}

function DashboardView({
  bootstrap,
  dashboard,
  go,
}: {
  bootstrap: SalesOpsBootstrap;
  dashboard: ReturnType<typeof buildDashboardModel>;
  go: (view: SalesOpsView) => void;
}) {
  const closedSalesLabel =
    dashboard.kpis.closedSalesCount === 1 ? '1 venda registrada' : `${dashboard.kpis.closedSalesCount} vendas registradas`;
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="grid gap-[14px] xl:grid-cols-4 md:grid-cols-2">
        <MetricCard
          accent="green"
          label="Receita fechada no mês"
          sub={closedSalesLabel}
          value={formatMoneyBrl(dashboard.kpis.closedRevenueBrl, { maximumFractionDigits: 0 })}
        />
        <MetricCard
          accent="green"
          label="MRR ativo"
          sub="Contratos recorrentes persistidos"
          value={formatMoneyBrl(dashboard.kpis.activeMrrBrl, { maximumFractionDigits: 0 })}
        />
        <MetricCard
          accent="red"
          label="Comissões a pagar"
          sub={`${bootstrap.payables.filter((payable) => payable.status === 'open').length} itens em aberto`}
          value={formatMoneyBrl(dashboard.kpis.payableBrl, { maximumFractionDigits: 0 })}
        />
        <MetricCard
          accent="blue"
          label="Vendas fechadas"
          sub="Status fechado ou concluído"
          value={String(dashboard.kpis.closedSalesCount)}
        />
      </div>

      <div className={`${panelClass} p-5`}>
        <div className="mb-[18px] flex items-center justify-between">
          <h3 className="text-[15px] font-bold">Receita por produto</h3>
          <span className="text-xs text-[#9b9ba3]">Dados persistidos</span>
        </div>
        {dashboard.revenueByProduct.length > 0 ? (
          <div className="flex flex-col gap-[14px]">
            {dashboard.revenueByProduct.map((product, index) => (
              <div className="flex items-center gap-4" key={product.name}>
                <span className="w-[160px] flex-none truncate text-[13px] font-semibold">
                  {product.name}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-md bg-[#eeeef1]">
                  <div
                    className={`h-full rounded-md ${index % 3 === 0 ? 'bg-[#eaa81a]' : index % 3 === 1 ? 'bg-[#5a9166]' : 'bg-[#3f7cc4]'}`}
                    style={{ width: `${Math.max(8, product.widthPct)}%` }}
                  />
                </div>
                <span className="sales-ops-num w-28 flex-none text-right text-[13.5px] font-bold">
                  {formatMoneyBrl(product.amountBrl, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel
            text="Assim que uma venda real for criada, esta área exibirá o ranking por produto."
            title="Sem receita por produto"
          />
        )}
      </div>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <RankingPanel items={dashboard.topSellers} title="Top vendedores" />
        <RankingPanel items={dashboard.topFinders} title="Top finders" />
      </div>

      <div className={`${panelClass} p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-bold">Últimas vendas</h3>
          <button
            className="text-[13px] font-semibold text-[#9c7210]"
            onClick={() => go('vendas')}
            type="button"
          >
            Ver todas
          </button>
        </div>
        {dashboard.latestSales.length > 0 ? (
          <SalesMiniTable bootstrap={bootstrap} sales={dashboard.latestSales} />
        ) : (
          <EmptyPanel
            text="Use o botão Nova venda para registrar o primeiro negócio real."
            title="Nenhuma venda registrada"
          />
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: 'green' | 'red' | 'blue';
}) {
  const color = accent === 'green' ? 'text-[#2f9155]' : accent === 'red' ? 'text-[#c0402a]' : 'text-[#3f7cc4]';
  return (
    <div className={`${panelClass} p-[18px]`}>
      <div className="text-[13px] font-semibold leading-tight text-[#8b8b92]">{label}</div>
      <div className={`sales-ops-num mt-[13px] text-[30px] font-bold tracking-normal ${color}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[#9b9ba3]">{sub}</div>
    </div>
  );
}

function RankingPanel({
  items,
  title,
}: {
  items: Array<{ name: string; totalBrl: number; commissionBrl: number; count: number }>;
  title: string;
}) {
  return (
    <div className={`${panelClass} p-[18px]`}>
      <h3 className="mb-[13px] text-sm font-bold">{title}</h3>
      {items.length > 0 ? (
        <div className="flex flex-col gap-[11px]">
          {items.slice(0, 5).map((item, index) => (
            <div className="flex items-center gap-[11px]" key={item.name}>
              <div className="sales-ops-num flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#f7e2a8] text-[13px] font-bold text-[#7a5a12]">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{item.name}</div>
                <div className="text-xs text-[#9b9ba3]">
                  {item.count} vendas · {formatMoneyBrl(item.totalBrl, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="sales-ops-num text-[13.5px] font-bold text-[#9c7210]">
                {formatMoneyBrl(item.commissionBrl, { maximumFractionDigits: 0 })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel
          text="O ranking será calculado a partir das vendas fechadas."
          title="Sem ranking no período"
        />
      )}
    </div>
  );
}

function SalesMiniTable({ bootstrap, sales }: { bootstrap: SalesOpsBootstrap; sales: SalesOpsBootstrap['sales'] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={tableHeadClass}>Cliente</TableHead>
          <TableHead className={tableHeadClass}>Produto</TableHead>
          <TableHead className={tableHeadClass}>Vendedor</TableHead>
          <TableHead className={tableHeadClass}>Finder</TableHead>
          <TableHead className={`${tableHeadClass} text-right`}>Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell className="px-4 py-3 text-[13.5px] font-semibold">
              {sale.clientNameSnapshot}
            </TableCell>
            <TableCell className={tableCellClass}>{salePrimaryProductName(bootstrap, sale.id)}</TableCell>
            <TableCell className={tableCellClass}>{sale.sellerNameSnapshot}</TableCell>
            <TableCell className={tableCellClass}>{sale.finderNameSnapshot ?? 'Sem finder'}</TableCell>
            <TableCell className="sales-ops-num px-4 py-3 text-right text-[13.5px] font-bold">
              {formatMoneyBrl(sale.totalBrl, { maximumFractionDigits: 0 })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SalesView({ bootstrap }: { bootstrap: SalesOpsBootstrap }) {
  if (bootstrap.sales.length === 0) {
    return (
      <EmptyPanel
        text="As vendas são carregadas da API de operações comerciais. Nenhuma linha de demonstração é renderizada."
        title="Nenhuma venda persistida"
      />
    );
  }

  return (
    <div className={`${panelClass} overflow-hidden`}>
      <Table>
        <TableHeader>
          <TableRow className="bg-[#fafafb] hover:bg-[#fafafb]">
            <TableHead className={tableHeadClass}>Código</TableHead>
            <TableHead className={tableHeadClass}>Cliente</TableHead>
            <TableHead className={tableHeadClass}>Produto</TableHead>
            <TableHead className={tableHeadClass}>Vendedor</TableHead>
            <TableHead className={tableHeadClass}>Finder</TableHead>
            <TableHead className={`${tableHeadClass} text-right`}>Valor</TableHead>
            <TableHead className={tableHeadClass}>Condição</TableHead>
            <TableHead className={tableHeadClass}>Status</TableHead>
            <TableHead className={`${tableHeadClass} text-right`}>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bootstrap.sales.map((sale) => {
            const meta = statusMeta(sale.status);
            return (
              <TableRow key={sale.id}>
                <TableCell className="px-4 py-3">
                  <span className="sales-ops-num rounded-md bg-[#eef3f9] px-2 py-1 text-xs font-bold tracking-[0.04em] text-[#3f6ea3]">
                    {sale.code}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-sm font-semibold text-[#201f24]">
                  {sale.clientNameSnapshot}
                </TableCell>
                <TableCell className={tableCellClass}>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#201f24]">
                      {salePrimaryProductName(bootstrap, sale.id)}
                    </span>
                    <span className="text-[11.5px] text-[#9b9ba3]">{sale.paymentMethod}</span>
                  </div>
                </TableCell>
                <TableCell className={tableCellClass}>{sale.sellerNameSnapshot}</TableCell>
                <TableCell className={tableCellClass}>{sale.finderNameSnapshot ?? 'Sem finder'}</TableCell>
                <TableCell className="sales-ops-num px-4 py-3 text-right text-sm font-bold">
                  {formatMoneyBrl(sale.totalBrl, { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className={tableCellClass}>{conditionLabel(sale.condition, sale.installments)}</TableCell>
                <TableCell className="px-4 py-3">
                  <Badge className={meta.className}>{meta.label}</Badge>
                </TableCell>
                <TableCell className="sales-ops-num px-4 py-3 text-right text-[13px] text-[#8b8b92]">
                  {displayDate(sale.baseDate)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PeopleView({
  bootstrap,
  mode,
  onEdit,
}: {
  bootstrap: SalesOpsBootstrap;
  mode: 'seller' | 'finder';
  onEdit: (person: SalesOpsPerson) => void;
}) {
  const people = bootstrap.people.filter((person) => (mode === 'seller' ? person.isSeller : person.isFinder));
  if (people.length === 0) {
    return (
      <EmptyPanel
        text={`Cadastre ${mode === 'seller' ? 'vendedores' : 'finders'} reais para acompanhar performance e comissões.`}
        title={`Nenhum ${mode === 'seller' ? 'vendedor' : 'finder'} cadastrado`}
      />
    );
  }

  return (
    <div className="grid gap-[14px] xl:grid-cols-3 md:grid-cols-2">
      {people.map((person) => {
        const metrics = personMetrics(bootstrap, person, mode);
        return (
          <button
            className={`${panelClass} p-5 text-left transition hover:border-[#d8c79a]`}
            key={person.id}
            onClick={() => onEdit(person)}
            type="button"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="sales-ops-num flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[13px] bg-gradient-to-br from-[#eaa81a] to-[#9c7210] text-[17px] font-bold text-white">
                {initials(person.displayName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-bold">{person.displayName}</div>
                <div className="text-[12.5px] text-[#8b8b92]">
                  {metrics.sales.length} vendas no período
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-[#eeeef1] pt-[14px]">
              <div>
                <div className="text-[11.5px] font-semibold text-[#9b9ba3]">Comissão</div>
                <div className="sales-ops-num mt-0.5 text-lg font-bold text-[#9c7210]">
                  {formatMoneyBrl(metrics.commissionBrl, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-[11.5px] font-semibold text-[#9b9ba3]">Ticket médio</div>
                <div className="sales-ops-num mt-0.5 text-lg font-bold">
                  {formatMoneyBrl(metrics.ticketBrl, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CommissionsView({ bootstrap }: { bootstrap: SalesOpsBootstrap }) {
  const totalOpen = bootstrap.payables
    .filter((payable) => payable.status === 'open')
    .reduce((sum, payable) => sum + payable.amountBrl, 0);
  const totalPaid = bootstrap.payables
    .filter((payable) => payable.status === 'paid')
    .reduce((sum, payable) => sum + payable.amountBrl, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-[14px] md:grid-cols-2">
        <MetricCard
          accent="red"
          label="Total a pagar"
          sub="Itens em aberto"
          value={formatMoneyBrl(totalOpen, { maximumFractionDigits: 0 })}
        />
        <MetricCard
          accent="green"
          label="Total pago no mês"
          sub="Baixas registradas"
          value={formatMoneyBrl(totalPaid, { maximumFractionDigits: 0 })}
        />
      </div>
      {bootstrap.payables.length > 0 ? (
        <div className={`${panelClass} overflow-hidden`}>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#fafafb] hover:bg-[#fafafb]">
                <TableHead className={tableHeadClass}>Beneficiário</TableHead>
                <TableHead className={tableHeadClass}>Tipo</TableHead>
                <TableHead className={`${tableHeadClass} text-right`}>Valor</TableHead>
                <TableHead className={`${tableHeadClass} text-right`}>Vencimento</TableHead>
                <TableHead className={tableHeadClass}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bootstrap.payables.map((payable, index) => {
                const meta = payableTypeMeta(payable.kind);
                return (
                  <TableRow key={payable.id ?? `${payable.saleId}-${index}`}>
                    <TableCell className="px-4 py-3 text-[13.5px] font-semibold">
                      {payable.beneficiaryName}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className={meta.className}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="sales-ops-num px-4 py-3 text-right text-[13.5px] font-bold">
                      {formatMoneyBrl(payable.amountBrl, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="sales-ops-num px-4 py-3 text-right text-[13px] text-[#57575f]">
                      {displayDate(payable.dueDate)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        className={
                          payable.status === 'paid'
                            ? 'bg-[#c9e7cf] text-[#1f7d43]'
                            : 'bg-[#fdf0cf] text-[#7a5a12]'
                        }
                      >
                        {payable.status === 'paid' ? 'Pago' : 'Aberto'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyPanel
          text="As contas a pagar são geradas automaticamente quando uma venda é salva."
          title="Nenhuma comissão gerada"
        />
      )}
    </div>
  );
}

function ProductsView({
  products,
  onEdit,
}: {
  products: SalesOpsProduct[];
  onEdit: (product: SalesOpsProduct) => void;
}) {
  if (products.length === 0) {
    return (
      <EmptyPanel
        text="Cadastre produtos reais para habilitar a criação de vendas e códigos automáticos."
        title="Nenhum produto cadastrado"
      />
    );
  }

  return (
    <div className={`${panelClass} overflow-hidden`}>
      <Table>
        <TableHeader>
          <TableRow className="bg-[#fafafb] hover:bg-[#fafafb]">
            <TableHead className={tableHeadClass}>Nome</TableHead>
            <TableHead className={tableHeadClass}>Tipo</TableHead>
            <TableHead className={`${tableHeadClass} text-center`}>Cód.</TableHead>
            <TableHead className={`${tableHeadClass} text-right`}>Setup</TableHead>
            <TableHead className={`${tableHeadClass} text-right`}>Mensalidade</TableHead>
            <TableHead className={`${tableHeadClass} text-center`}>Com. vend.</TableHead>
            <TableHead className={`${tableHeadClass} text-center`}>Com. finder</TableHead>
            <TableHead className={`${tableHeadClass} text-center`}>Recorrente</TableHead>
            <TableHead className={`${tableHeadClass} text-center`}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="px-4 py-3 text-sm font-semibold">{product.name}</TableCell>
              <TableCell className={tableCellClass}>{product.type}</TableCell>
              <TableCell className="px-4 py-3 text-center">
                <span className="sales-ops-num rounded-md bg-[#fdf0cf] px-2 py-1 text-xs font-bold tracking-[0.04em] text-[#9c7210]">
                  ...{product.codeSuffix}
                </span>
              </TableCell>
              <TableCell className="sales-ops-num px-4 py-3 text-right text-[13.5px]">
                {product.openPrice ? 'Aberto' : formatMoneyBrl(product.setupBrl, { maximumFractionDigits: 0 })}
              </TableCell>
              <TableCell className="sales-ops-num px-4 py-3 text-right text-[13.5px]">
                {product.hasMonthly
                  ? product.openPrice
                    ? 'Aberto'
                    : formatMoneyBrl(product.monthlyBrl, { maximumFractionDigits: 0 })
                  : '-'}
              </TableCell>
              <TableCell className="sales-ops-num px-4 py-3 text-center text-[13.5px] font-semibold">
                {product.sellerCommissionValue}
                {product.sellerCommissionType === 'pct' ? '%' : ''}
              </TableCell>
              <TableCell className="sales-ops-num px-4 py-3 text-center text-[13.5px] font-semibold">
                {product.hasFinderCommission
                  ? `${product.finderCommissionValue}${product.finderCommissionType === 'pct' ? '%' : ''}`
                  : '-'}
              </TableCell>
              <TableCell className="px-4 py-3 text-center">
                <Badge
                  className={
                    product.recurringCommission
                      ? 'bg-[#c9e7cf] text-[#1f7d43]'
                      : 'bg-[#eeeef1] text-[#6a6a72]'
                  }
                >
                  {product.recurringCommission ? 'Sim' : 'Não'}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 text-center">
                <button className={iconButtonClass} onClick={() => onEdit(product)} type="button">
                  <Edit3 className="h-[15px] w-[15px]" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientsView({
  bootstrap,
  onEdit,
}: {
  bootstrap: SalesOpsBootstrap;
  onEdit: (client: SalesOpsClient) => void;
}) {
  if (bootstrap.clients.length === 0) {
    return (
      <EmptyPanel
        text="Clientes criados no cadastro ou na venda aparecem aqui com receita acumulada."
        title="Nenhum cliente cadastrado"
      />
    );
  }

  return (
    <div className={`${panelClass} overflow-hidden`}>
      <Table>
        <TableHeader>
          <TableRow className="bg-[#fafafb] hover:bg-[#fafafb]">
            <TableHead className={tableHeadClass}>Nome</TableHead>
            <TableHead className={tableHeadClass}>Contato</TableHead>
            <TableHead className={`${tableHeadClass} text-center`}>Nº vendas</TableHead>
            <TableHead className={`${tableHeadClass} text-right`}>Receita total</TableHead>
            <TableHead className={`${tableHeadClass} text-center`}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bootstrap.clients.map((client) => {
            const sales = bootstrap.sales.filter(
              (sale) => sale.clientId === client.id || sale.clientNameSnapshot === client.name,
            );
            const total = sales.reduce((sum, sale) => sum + sale.totalBrl, 0);
            return (
              <TableRow key={client.id}>
                <TableCell className="px-4 py-3 text-sm font-semibold">{client.name}</TableCell>
                <TableCell className={tableCellClass}>{client.contact ?? '-'}</TableCell>
                <TableCell className="sales-ops-num px-4 py-3 text-center text-[13.5px]">
                  {sales.length}
                </TableCell>
                <TableCell className="sales-ops-num px-4 py-3 text-right text-[13.5px] font-bold">
                  {formatMoneyBrl(total, { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="px-4 py-3 text-center">
                  <button className={iconButtonClass} onClick={() => onEdit(client)} type="button">
                    <Edit3 className="h-[15px] w-[15px]" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SettingsView({
  settings,
  onSave,
  isSaving,
}: {
  settings: SalesOpsSettings | null;
  onSave: (payload: SaveSettingsPayload) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(() => activeSettings(settings));

  function set<K extends keyof SaveSettingsPayload>(key: K, value: SaveSettingsPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      ...form,
      defaultSellerCommissionPct: Number(form.defaultSellerCommissionPct ?? 10),
      defaultFinderCommissionPct: Number(form.defaultFinderCommissionPct ?? 3),
      defaultTaxPct: Number(form.defaultTaxPct ?? 6),
      periodClosingDay: Number(form.periodClosingDay ?? 1),
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-[14px] xl:grid-cols-2">
        <div className={`${panelClass} p-[22px]`}>
          <h3 className="mb-4 text-[15px] font-bold">Dados da empresa</h3>
          <div className="grid gap-[13px]">
            <Field label="Razão social">
              <Input
                className="bg-[#fafafb]"
                onChange={(event) => set('legalName', event.target.value)}
                value={form.legalName ?? ''}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="CNPJ">
                <Input
                  className="bg-[#fafafb]"
                  onChange={(event) => set('document', event.target.value)}
                  value={form.document ?? ''}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  className="bg-[#fafafb]"
                  onChange={(event) => set('phone', event.target.value)}
                  value={form.phone ?? ''}
                />
              </Field>
            </div>
            <Field label="E-mail financeiro">
              <Input
                className="bg-[#fafafb]"
                onChange={(event) => set('financeEmail', event.target.value)}
                value={form.financeEmail ?? ''}
              />
            </Field>
          </div>
        </div>

        <div className={`${panelClass} p-[22px]`}>
          <h3 className="mb-4 text-[15px] font-bold">Comissões padrão</h3>
          <div className="grid gap-[13px]">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Comissão vendedor %">
                <Input
                  className="sales-ops-num bg-[#fafafb]"
                  min={0}
                  onChange={(event) => set('defaultSellerCommissionPct', Number(event.target.value))}
                  type="number"
                  value={form.defaultSellerCommissionPct ?? 10}
                />
              </Field>
              <Field label="Comissão finder %">
                <Input
                  className="sales-ops-num bg-[#fafafb]"
                  min={0}
                  onChange={(event) => set('defaultFinderCommissionPct', Number(event.target.value))}
                  type="number"
                  value={form.defaultFinderCommissionPct ?? 3}
                />
              </Field>
            </div>
            <Toggle
              checked={Boolean(form.commissionOnRecurring)}
              description="Aplicar percentual também sobre mensalidades"
              label="Comissão incide sobre recorrente"
              onChange={(value) => set('commissionOnRecurring', value)}
            />
            <Toggle
              checked={Boolean(form.sellerCanBeFinder)}
              description="Permite comissão dupla na mesma venda"
              label="Vendedor pode ser finder"
              onChange={(value) => set('sellerCanBeFinder', value)}
            />
          </div>
        </div>

        <div className={`${panelClass} p-[22px]`}>
          <h3 className="mb-4 text-[15px] font-bold">Financeiro</h3>
          <div className="grid gap-[13px]">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Imposto padrão %">
                <Input
                  className="sales-ops-num bg-[#fafafb]"
                  min={0}
                  onChange={(event) => set('defaultTaxPct', Number(event.target.value))}
                  type="number"
                  value={form.defaultTaxPct ?? 6}
                />
              </Field>
              <Field label="Moeda">
                <NativeSelect
                  onChange={(value) => set('currency', value)}
                  value={form.currency ?? 'BRL'}
                >
                  <option value="BRL">Real (BRL)</option>
                  <option value="USD">Dólar (USD)</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Regime tributário">
              <NativeSelect
                onChange={(value) => set('taxRegime', value)}
                value={form.taxRegime ?? 'Simples Nacional'}
              >
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </NativeSelect>
            </Field>
            <Field label="Dia de fechamento do período">
              <Input
                className="sales-ops-num bg-[#fafafb]"
                max={31}
                min={1}
                onChange={(event) => set('periodClosingDay', Number(event.target.value))}
                type="number"
                value={form.periodClosingDay ?? 1}
              />
            </Field>
          </div>
        </div>

        <div className={`${panelClass} p-[22px]`}>
          <h3 className="mb-4 text-[15px] font-bold">Preferências de exibição</h3>
          <div className="grid gap-[15px]">
            <Field label="Densidade das tabelas">
              <div className="flex gap-2">
                {(['comfortable', 'compact'] as const).map((density) => (
                  <button
                    className={`flex-1 rounded-[10px] border px-3 py-2 text-[13.5px] font-bold ${
                      form.tableDensity === density
                        ? 'border-[#eaa81a] bg-[#eef0f3] text-[#9c7210]'
                        : 'border-[#dcdce2] bg-[#fafafb] text-[#57575f]'
                    }`}
                    key={density}
                    onClick={() => set('tableDensity', density)}
                    type="button"
                  >
                    {density === 'comfortable' ? 'Confortável' : 'Compacta'}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Formato de data">
                <Input
                  className="bg-[#fafafb]"
                  onChange={(event) => set('dateFormat', event.target.value)}
                  value={form.dateFormat ?? 'dd/mm/aaaa'}
                />
              </Field>
              <Field label="Idioma">
                <NativeSelect
                  onChange={(value) => set('language', value)}
                  value={form.language ?? 'pt-BR'}
                >
                  <option value="pt-BR">Português (BR)</option>
                  <option value="en">English</option>
                </NativeSelect>
              </Field>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <PrimaryButton disabled={isSaving} type="submit">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </PrimaryButton>
      </div>
    </form>
  );
}

type ProductForm = {
  name: string;
  type: string;
  codeSuffix: string;
  openPrice: boolean;
  setupBrl: string;
  hasMonthly: boolean;
  monthlyBrl: string;
  recurringCommission: boolean;
  hasFinderCommission: boolean;
  sellerCommissionType: 'pct' | 'fix';
  sellerCommissionValue: string;
  finderCommissionType: 'pct' | 'fix';
  finderCommissionValue: string;
  modules: Array<{ name: string; type: string; valueBrl: string }>;
  providers: Array<{ personName: string; commissionType: 'pct' | 'fix'; commissionValue: string }>;
};

function productForm(product?: SalesOpsProduct): ProductForm {
  return {
    name: product?.name ?? '',
    type: product?.type ?? 'SaaS',
    codeSuffix: product?.codeSuffix ?? '0',
    openPrice: product?.openPrice ?? false,
    setupBrl: centsToInput(product?.setupBrl),
    hasMonthly: product?.hasMonthly ?? false,
    monthlyBrl: centsToInput(product?.monthlyBrl),
    recurringCommission: product?.recurringCommission ?? false,
    hasFinderCommission: product?.hasFinderCommission ?? false,
    sellerCommissionType: product?.sellerCommissionType ?? 'pct',
    sellerCommissionValue: pctToInput(product?.sellerCommissionValue, 10),
    finderCommissionType: product?.finderCommissionType ?? 'pct',
    finderCommissionValue: pctToInput(product?.finderCommissionValue, 3),
    modules: product?.modules.map((module) => ({
      name: module.name,
      type: module.type,
      valueBrl: centsToInput(module.valueBrl),
    })) ?? [],
    providers: product?.providers.map((provider) => ({
      personName: provider.personName,
      commissionType: provider.commissionType,
      commissionValue: String(provider.commissionValue),
    })) ?? [],
  };
}

function ProductDialog(props: {
  modal: Extract<ModalState, { kind: 'product' }> | null;
  collaborators: SalesOpsPerson[];
  onClose: () => void;
  onSave: (payload: SaveProductPayload) => void;
  saving: boolean;
}) {
  if (!props.modal) return null;
  return (
    <ProductDialogBody
      key={props.modal.product?.id ?? 'new-product'}
      collaborators={props.collaborators}
      modal={props.modal}
      onClose={props.onClose}
      onSave={props.onSave}
      saving={props.saving}
    />
  );
}

function ProductDialogBody({
  modal,
  collaborators,
  onClose,
  onSave,
  saving,
}: {
  modal: Extract<ModalState, { kind: 'product' }>;
  collaborators: SalesOpsPerson[];
  onClose: () => void;
  onSave: (payload: SaveProductPayload) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ProductForm>(() => productForm(modal?.product));
  const activeModal = modal;

  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload: SaveProductPayload = {
      id: activeModal.product?.id,
      name: form.name.trim(),
      type: form.type.trim() || 'SaaS',
      codeSuffix: form.codeSuffix.replace(/\D/g, '').slice(0, 2) || '0',
      openPrice: form.openPrice,
      setupBrl: form.openPrice ? 0 : parseCurrencyToCents(form.setupBrl),
      hasMonthly: form.hasMonthly,
      monthlyBrl: form.openPrice || !form.hasMonthly ? 0 : parseCurrencyToCents(form.monthlyBrl),
      recurringCommission: form.hasMonthly && form.recurringCommission,
      hasFinderCommission: form.hasFinderCommission,
      sellerCommissionType: form.sellerCommissionType,
      sellerCommissionValue: parseDecimal(form.sellerCommissionValue, 10),
      finderCommissionType: form.finderCommissionType,
      finderCommissionValue: form.hasFinderCommission ? parseDecimal(form.finderCommissionValue, 3) : 0,
      modules: form.modules
        .filter((module) => module.name.trim())
        .map((module) => ({
          name: module.name.trim(),
          type: module.type.trim() || 'Upsell',
          valueBrl: parseCurrencyToCents(module.valueBrl),
        })),
      providers: form.providers
        .filter((provider) => provider.personName.trim())
        .map((provider) => ({
          personName: provider.personName.trim(),
          commissionType: provider.commissionType,
          commissionValue: parseDecimal(provider.commissionValue, 0),
        })),
      status: 'active',
    };
    onSave(payload);
  }

  return (
    <Dialog onOpenChange={(open) => (!open ? onClose() : undefined)} open>
      <DialogContent className="max-h-[92vh] max-w-[620px] overflow-y-auto rounded-[20px] border-none bg-white p-0">
        <DialogHeader className="border-b border-[#e8e8ec] px-6 py-5 text-left">
          <DialogTitle className="sales-ops-num text-[19px]">Produto</DialogTitle>
          <DialogDescription>Catálogo, preço, código e comissionamento.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4 px-6 py-5" onSubmit={submit}>
          <Field label="Nome" required>
            <Input
              className="bg-[#fafafb]"
              onChange={(event) => set('name', event.target.value)}
              value={form.name}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <Input
                className="bg-[#fafafb]"
                onChange={(event) => set('type', event.target.value)}
                value={form.type}
              />
            </Field>
            <Field label="Final do código">
              <Input
                className="sales-ops-num bg-[#fafafb]"
                inputMode="numeric"
                maxLength={2}
                onChange={(event) => set('codeSuffix', event.target.value)}
                value={form.codeSuffix}
              />
            </Field>
          </div>
          <Toggle
            checked={form.openPrice}
            description="Valor definido diretamente na venda"
            label="Preço em aberto"
            onChange={(value) => set('openPrice', value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Setup (R$)">
              <Input
                className="sales-ops-num bg-[#fafafb]"
                disabled={form.openPrice}
                onChange={(event) => set('setupBrl', event.target.value)}
                value={form.setupBrl}
              />
            </Field>
            <Field label="Mensalidade (R$)">
              <Input
                className="sales-ops-num bg-[#fafafb]"
                disabled={form.openPrice || !form.hasMonthly}
                onChange={(event) => set('monthlyBrl', event.target.value)}
                value={form.monthlyBrl}
              />
            </Field>
          </div>
          <Toggle
            checked={form.hasMonthly}
            description="Cobrança recorrente além do setup"
            label="Possui mensalidade"
            onChange={(value) => set('hasMonthly', value)}
          />
          <Toggle
            checked={form.recurringCommission}
            description="Aplicar comissão também na mensalidade"
            label="Incide sobre recorrente"
            onChange={(value) => set('recurringCommission', value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Comissão vendedor">
              <div className="flex gap-2">
                <NativeSelect
                  className="w-[86px]"
                  onChange={(value) => set('sellerCommissionType', value as 'pct' | 'fix')}
                  value={form.sellerCommissionType}
                >
                  <option value="pct">%</option>
                  <option value="fix">R$</option>
                </NativeSelect>
                <Input
                  className="sales-ops-num bg-[#fafafb]"
                  onChange={(event) => set('sellerCommissionValue', event.target.value)}
                  value={form.sellerCommissionValue}
                />
              </div>
            </Field>
            <Field label="Comissão finder">
              <div className="flex gap-2">
                <NativeSelect
                  className="w-[86px]"
                  disabled={!form.hasFinderCommission}
                  onChange={(value) => set('finderCommissionType', value as 'pct' | 'fix')}
                  value={form.finderCommissionType}
                >
                  <option value="pct">%</option>
                  <option value="fix">R$</option>
                </NativeSelect>
                <Input
                  className="sales-ops-num bg-[#fafafb]"
                  disabled={!form.hasFinderCommission}
                  onChange={(event) => set('finderCommissionValue', event.target.value)}
                  value={form.finderCommissionValue}
                />
              </div>
            </Field>
          </div>
          <Toggle
            checked={form.hasFinderCommission}
            description="Habilita comissão para quem indicou"
            label="Vendedor + Finder"
            onChange={(value) => set('hasFinderCommission', value)}
          />

          <ListEditor
            addLabel="Adicionar módulo"
            empty="Nenhum módulo adicionado"
            onAdd={() =>
              set('modules', [...form.modules, { name: '', type: 'Upsell', valueBrl: '0.00' }])
            }
            title="Módulos"
          >
            {form.modules.map((module, index) => (
              <div className="grid gap-2 rounded-xl border border-[#ececf1] bg-[#fafafb] p-3 md:grid-cols-[1fr_120px_120px_34px]" key={index}>
                <Input
                  className="bg-white"
                  onChange={(event) => {
                    const next = [...form.modules];
                    next[index] = { ...module, name: event.target.value };
                    set('modules', next);
                  }}
                  placeholder="Nome"
                  value={module.name}
                />
                <Input
                  className="bg-white"
                  onChange={(event) => {
                    const next = [...form.modules];
                    next[index] = { ...module, type: event.target.value };
                    set('modules', next);
                  }}
                  placeholder="Tipo"
                  value={module.type}
                />
                <Input
                  className="sales-ops-num bg-white"
                  onChange={(event) => {
                    const next = [...form.modules];
                    next[index] = { ...module, valueBrl: event.target.value };
                    set('modules', next);
                  }}
                  placeholder="0.00"
                  value={module.valueBrl}
                />
                <button
                  className={iconButtonClass}
                  onClick={() => set('modules', form.modules.filter((_, itemIndex) => itemIndex !== index))}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </ListEditor>

          <ListEditor
            addLabel="Adicionar prestador"
            empty="Nenhum prestador vinculado"
            onAdd={() =>
              set('providers', [
                ...form.providers,
                {
                  personName: collaborators[0]?.displayName ?? '',
                  commissionType: 'pct',
                  commissionValue: '0',
                },
              ])
            }
            title="Prestadores de serviço"
          >
            {form.providers.map((provider, index) => (
              <div className="grid gap-2 rounded-xl border border-[#ececf1] bg-[#fafafb] p-3 md:grid-cols-[1fr_92px_120px_34px]" key={index}>
                <Input
                  className="bg-white"
                  list="sales-ops-collaborators"
                  onChange={(event) => {
                    const next = [...form.providers];
                    next[index] = { ...provider, personName: event.target.value };
                    set('providers', next);
                  }}
                  placeholder="Nome"
                  value={provider.personName}
                />
                <NativeSelect
                  className="bg-white"
                  onChange={(value) => {
                    const next = [...form.providers];
                    next[index] = { ...provider, commissionType: value as 'pct' | 'fix' };
                    set('providers', next);
                  }}
                  value={provider.commissionType}
                >
                  <option value="pct">%</option>
                  <option value="fix">R$</option>
                </NativeSelect>
                <Input
                  className="sales-ops-num bg-white"
                  onChange={(event) => {
                    const next = [...form.providers];
                    next[index] = { ...provider, commissionValue: event.target.value };
                    set('providers', next);
                  }}
                  value={provider.commissionValue}
                />
                <button
                  className={iconButtonClass}
                  onClick={() =>
                    set('providers', form.providers.filter((_, itemIndex) => itemIndex !== index))
                  }
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </ListEditor>
          <datalist id="sales-ops-collaborators">
            {collaborators.map((person) => (
              <option key={person.id} value={person.displayName} />
            ))}
          </datalist>

          <div className="flex justify-end gap-3 border-t border-[#e8e8ec] pt-4">
            <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
            <PrimaryButton disabled={saving || !form.name.trim()} type="submit">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListEditor({
  title,
  empty,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  empty: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="border-t border-[#ececf1] pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#9b9ba3]">
            {title}
          </div>
        </div>
        <SecondaryButton onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </SecondaryButton>
      </div>
      <div className="flex flex-col gap-2">
        {hasChildren ? children : <div className="rounded-xl border border-dashed border-[#dcdce2] p-4 text-center text-[12.5px] text-[#a0a0a8]">{empty}</div>}
      </div>
    </div>
  );
}

function ClientDialog(props: {
  modal: Extract<ModalState, { kind: 'client' }> | null;
  onClose: () => void;
  onSave: (payload: SaveClientPayload) => void;
  saving: boolean;
}) {
  if (!props.modal) return null;
  return (
    <ClientDialogBody
      key={props.modal.client?.id ?? 'new-client'}
      modal={props.modal}
      onClose={props.onClose}
      onSave={props.onSave}
      saving={props.saving}
    />
  );
}

function ClientDialogBody({
  modal,
  onClose,
  onSave,
  saving,
}: {
  modal: Extract<ModalState, { kind: 'client' }>;
  onClose: () => void;
  onSave: (payload: SaveClientPayload) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(modal.client?.name ?? '');
  const [contact, setContact] = useState(modal.client?.contact ?? '');
  const activeModal = modal;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ id: activeModal.client?.id, name: name.trim(), contact: contact.trim() || undefined });
  }

  return (
    <Dialog onOpenChange={(open) => (!open ? onClose() : undefined)} open>
      <DialogContent className="max-w-[520px] rounded-[20px] border-none bg-white p-0">
        <DialogHeader className="border-b border-[#e8e8ec] px-6 py-5 text-left">
          <DialogTitle className="sales-ops-num text-[19px]">Cliente</DialogTitle>
          <DialogDescription>Nome comercial e contato principal.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4 px-6 py-5" onSubmit={submit}>
          <Field label="Nome" required>
            <Input className="bg-[#fafafb]" onChange={(event) => setName(event.target.value)} value={name} />
          </Field>
          <Field label="Contato">
            <Input
              className="bg-[#fafafb]"
              onChange={(event) => setContact(event.target.value)}
              placeholder="e-mail ou telefone"
              value={contact}
            />
          </Field>
          <div className="flex justify-end gap-3 border-t border-[#e8e8ec] pt-4">
            <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
            <PrimaryButton disabled={saving || !name.trim()} type="submit">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PersonDialog(props: {
  modal: Extract<ModalState, { kind: 'person' }> | null;
  onClose: () => void;
  onSave: (payload: SavePersonPayload) => void;
  saving: boolean;
}) {
  if (!props.modal) return null;
  return (
    <PersonDialogBody
      key={props.modal.person?.id ?? `new-${props.modal.roleHint}`}
      modal={props.modal}
      onClose={props.onClose}
      onSave={props.onSave}
      saving={props.saving}
    />
  );
}

function PersonDialogBody({
  modal,
  onClose,
  onSave,
  saving,
}: {
  modal: Extract<ModalState, { kind: 'person' }>;
  onClose: () => void;
  onSave: (payload: SavePersonPayload) => void;
  saving: boolean;
}) {
  const [displayName, setDisplayName] = useState(modal.person?.displayName ?? '');
  const [contactEmail, setContactEmail] = useState(modal.person?.contactEmail ?? '');
  const [isSeller, setIsSeller] = useState(modal.person?.isSeller ?? modal.roleHint === 'seller');
  const [isFinder, setIsFinder] = useState(modal.person?.isFinder ?? modal.roleHint === 'finder');
  const [isCollaborator, setIsCollaborator] = useState(
    modal.person?.isCollaborator ?? modal.roleHint === 'collaborator',
  );
  const [status, setStatus] = useState<'active' | 'inactive'>(modal.person?.status ?? 'active');
  const activeModal = modal;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: activeModal.person?.id,
      displayName: displayName.trim(),
      contactEmail: contactEmail.trim() || undefined,
      status,
      isSeller,
      isFinder,
      isCollaborator,
    });
  }

  return (
    <Dialog onOpenChange={(open) => (!open ? onClose() : undefined)} open>
      <DialogContent className="max-w-[520px] rounded-[20px] border-none bg-white p-0">
        <DialogHeader className="border-b border-[#e8e8ec] px-6 py-5 text-left">
          <DialogTitle className="sales-ops-num text-[19px]">Pessoa</DialogTitle>
          <DialogDescription>Vendedores, finders e prestadores usam o mesmo cadastro.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4 px-6 py-5" onSubmit={submit}>
          <Field label="Nome" required>
            <Input
              className="bg-[#fafafb]"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </Field>
          <Field label="E-mail">
            <Input
              className="bg-[#fafafb]"
              onChange={(event) => setContactEmail(event.target.value)}
              type="email"
              value={contactEmail}
            />
          </Field>
          <Field label="Status">
            <NativeSelect onChange={(value) => setStatus(value as 'active' | 'inactive')} value={status}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </NativeSelect>
          </Field>
          <div className="grid gap-2 md:grid-cols-3">
            <RoleToggle checked={isSeller} label="Vendedor" onChange={setIsSeller} />
            <RoleToggle checked={isFinder} label="Finder" onChange={setIsFinder} />
            <RoleToggle checked={isCollaborator} label="Prestador" onChange={setIsCollaborator} />
          </div>
          <div className="flex justify-end gap-3 border-t border-[#e8e8ec] pt-4">
            <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
            <PrimaryButton
              disabled={saving || !displayName.trim() || (!isSeller && !isFinder && !isCollaborator)}
              type="submit"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-[10px] border px-3 py-3 text-[13.5px] font-bold ${
        checked ? 'border-[#eaa81a] bg-[#fdf0cf] text-[#7a5a12]' : 'border-[#dcdce2] bg-[#fafafb] text-[#57575f]'
      }`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      {checked ? <Check className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
      {label}
    </button>
  );
}

type SaleItemForm = {
  productId: string;
  quantity: string;
  unitBrl: string;
};

type ProfessionalForm = {
  personId: string;
  personName: string;
  role: string;
  costBrl: string;
};

function SaleWizardDialog(props: {
  open: boolean;
  bootstrap: SalesOpsBootstrap;
  onClose: () => void;
  onSave: (payload: CreateSalePayload) => void;
  saving: boolean;
}) {
  if (!props.open) return null;
  return (
    <SaleWizardDialogBody
      key={`${props.bootstrap.clients[0]?.id ?? 'no-client'}-${props.bootstrap.products[0]?.id ?? 'no-product'}-${props.bootstrap.people.length}`}
      bootstrap={props.bootstrap}
      onClose={props.onClose}
      onSave={props.onSave}
      saving={props.saving}
    />
  );
}

function SaleWizardDialogBody({
  bootstrap,
  onClose,
  onSave,
  saving,
}: {
  bootstrap: SalesOpsBootstrap;
  onClose: () => void;
  onSave: (payload: CreateSalePayload) => void;
  saving: boolean;
}) {
  const settings = activeSettings(bootstrap.settings);
  const sellers = useMemo(
    () => bootstrap.people.filter((person) => person.isSeller && person.status === 'active'),
    [bootstrap.people],
  );
  const finders = useMemo(
    () => bootstrap.people.filter((person) => person.isFinder && person.status === 'active'),
    [bootstrap.people],
  );
  const collaborators = useMemo(
    () => bootstrap.people.filter((person) => person.isCollaborator && person.status === 'active'),
    [bootstrap.people],
  );
  const firstProduct = bootstrap.products[0];
  const firstClient = bootstrap.clients[0];
  const firstSeller = sellers[0];
  const [clientId, setClientId] = useState(firstClient?.id ?? '');
  const [clientName, setClientName] = useState(firstClient?.name ?? '');
  const [sellerPersonId, setSellerPersonId] = useState(firstSeller?.id ?? '');
  const [finderPersonId, setFinderPersonId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [condition, setCondition] = useState<PaymentCondition>('cash');
  const [installments, setInstallments] = useState('1');
  const [baseDate, setBaseDate] = useState(inputDateToday());
  const [notes, setNotes] = useState('');
  const [taxPct, setTaxPct] = useState(String(settings.defaultTaxPct ?? 6));
  const [sellerCommissionPct, setSellerCommissionPct] = useState(
    String(settings.defaultSellerCommissionPct ?? 10),
  );
  const [finderCommissionPct, setFinderCommissionPct] = useState(
    String(settings.defaultFinderCommissionPct ?? 3),
  );
  const [otherCostsBrl, setOtherCostsBrl] = useState('0.00');
  const [items, setItems] = useState<SaleItemForm[]>(() =>
    firstProduct
      ? [
          {
            productId: firstProduct.id,
            quantity: '1',
            unitBrl: centsToInput(
              firstProduct.openPrice ? 0 : firstProduct.setupBrl || firstProduct.monthlyBrl,
            ),
          },
        ]
      : [],
  );
  const [professionals, setProfessionals] = useState<ProfessionalForm[]>([]);

  const canSave = Boolean(clientName.trim() && sellerPersonId && items.length > 0);
  const totalCents = items.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity) || 1) * parseCurrencyToCents(item.unitBrl),
    0,
  );
  const professionalCents = professionals.reduce(
    (sum, professional) => sum + parseCurrencyToCents(professional.costBrl),
    0,
  );
  const sellerCommissionCents = Math.floor((totalCents * parseDecimal(sellerCommissionPct, 0)) / 100);
  const finderCommissionCents = finderPersonId
    ? Math.floor((totalCents * parseDecimal(finderCommissionPct, 0)) / 100)
    : 0;
  const taxCents = Math.floor((totalCents * parseDecimal(taxPct, 0)) / 100);
  const otherCents = parseCurrencyToCents(otherCostsBrl);
  const marginCents =
    totalCents - professionalCents - sellerCommissionCents - finderCommissionCents - taxCents - otherCents;
  const marginPct = totalCents > 0 ? Math.round((marginCents / totalCents) * 1000) / 10 : 0;

  function selectedProduct(item: SaleItemForm) {
    return bootstrap.products.find((product) => product.id === item.productId) ?? firstProduct;
  }

  function setItem(index: number, patch: Partial<SaleItemForm>) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.productId) {
          const product = bootstrap.products.find((candidate) => candidate.id === patch.productId);
          if (product) {
            next.unitBrl = centsToInput(product.openPrice ? 0 : product.setupBrl || product.monthlyBrl);
          }
        }
        return next;
      }),
    );
  }

  function addItem() {
    const product = bootstrap.products[0];
    if (!product) return;
    setItems((current) => [
      ...current,
      {
        productId: product.id,
        quantity: '1',
        unitBrl: centsToInput(product.openPrice ? 0 : product.setupBrl || product.monthlyBrl),
      },
    ]);
  }

  function createPayload(status: SalesOpsStatus): CreateSalePayload {
    const seller = sellers.find((person) => person.id === sellerPersonId);
    const finder = finders.find((person) => person.id === finderPersonId);
    const draft: SaleDraft = {
      clientId,
      clientName,
      sellerPersonId,
      sellerName: seller?.displayName ?? '',
      finderPersonId: finderPersonId || undefined,
      finderName: finder?.displayName,
      status,
      paymentMethod,
      condition,
      installments,
      baseDate,
      notes,
      sellerCommissionPct,
      finderCommissionPct,
      taxPct,
      otherCostsBrl: otherCents,
      items: items.map((item) => {
        const product = selectedProduct(item);
        return {
          productId: product?.id,
          productName: product?.name ?? 'Produto',
          productType: product?.type ?? 'SaaS',
          quantity: item.quantity,
          unitBrl: parseCurrencyToCents(item.unitBrl),
        };
      }),
      professionals: professionals.map((professional) => ({
        personId: professional.personId,
        personName: professional.personName,
        role: professional.role,
        costBrl: parseCurrencyToCents(professional.costBrl),
      })),
    };
    return buildSalePayload(draft);
  }

  function submit(status: SalesOpsStatus) {
    if (!canSave) return;
    onSave(createPayload(status));
  }

  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open>
      <DialogContent className="max-h-[92vh] max-w-[940px] overflow-hidden rounded-[22px] border-none bg-[#f4f4f6] p-0">
        <DialogHeader className="border-b border-[#e8e8ec] bg-white px-[26px] py-5 text-left">
          <DialogTitle className="sales-ops-num text-[19px]">Fechamento da venda</DialogTitle>
          <DialogDescription>
            Cliente, itens, responsáveis, pagamento e margem calculados a partir do formulário.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-152px)] overflow-y-auto px-[26px] py-6">
          {bootstrap.products.length === 0 || sellers.length === 0 ? (
            <EmptyPanel
              text="Cadastre pelo menos um produto e um vendedor para registrar uma venda real."
              title="Cadastro incompleto"
            />
          ) : (
            <div className="grid gap-[18px]">
              <div className={`${panelClass} grid gap-4 p-4`}>
                <div className="text-[13px] font-bold">Cliente e responsáveis</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Cliente" required>
                    <NativeSelect
                      onChange={(value) => {
                        const client = bootstrap.clients.find((candidate) => candidate.id === value);
                        setClientId(value);
                        setClientName(client?.name ?? '');
                      }}
                      value={clientId}
                    >
                      <option value="">Selecionar cliente</option>
                      {bootstrap.clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Novo cliente">
                    <Input
                      className="bg-[#fafafb]"
                      onChange={(event) => {
                        setClientName(event.target.value);
                        setClientId('');
                      }}
                      placeholder="Ou digite um novo nome"
                      value={clientId ? '' : clientName}
                    />
                  </Field>
                  <Field label="Vendedor" required>
                    <NativeSelect onChange={setSellerPersonId} value={sellerPersonId}>
                      {sellers.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.displayName}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Finder">
                    <NativeSelect onChange={setFinderPersonId} value={finderPersonId}>
                      <option value="">Sem finder</option>
                      {finders.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.displayName}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              </div>

              <div className={`${panelClass} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[13px] font-bold">Itens</div>
                  <SecondaryButton onClick={addItem}>
                    <Plus className="h-4 w-4" />
                    Item
                  </SecondaryButton>
                </div>
                <div className="grid gap-2">
                  {items.map((item, index) => {
                    const product = selectedProduct(item);
                    return (
                      <div
                        className="grid gap-2 md:grid-cols-[1fr_76px_140px_118px_34px]"
                        key={`${item.productId}-${index}`}
                      >
                        <NativeSelect
                          onChange={(value) => setItem(index, { productId: value })}
                          value={item.productId}
                        >
                          {bootstrap.products.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </option>
                          ))}
                        </NativeSelect>
                        <Input
                          className="sales-ops-num bg-[#fafafb] text-center"
                          min={1}
                          onChange={(event) => setItem(index, { quantity: event.target.value })}
                          type="number"
                          value={item.quantity}
                        />
                        <Input
                          className="sales-ops-num bg-[#fafafb] text-right"
                          onChange={(event) => setItem(index, { unitBrl: event.target.value })}
                          value={item.unitBrl}
                        />
                        <div className="sales-ops-num flex h-10 items-center justify-end text-[13.5px] font-bold">
                          {formatMoneyBrl(
                            Math.max(1, Number(item.quantity) || 1) * parseCurrencyToCents(item.unitBrl),
                            { maximumFractionDigits: 0 },
                          )}
                        </div>
                        <button
                          className={iconButtonClass}
                          onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {product?.openPrice ? (
                          <div className="md:col-span-5 text-[11.5px] font-semibold text-[#9c7210]">
                            Produto com preço em aberto. Informe o valor negociado.
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`${panelClass} grid gap-4 p-4`}>
                <div className="text-[13px] font-bold">Pagamento e recebimento</div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Forma" required>
                    <NativeSelect
                      onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                      value={paymentMethod}
                    >
                      <option value="pix">Pix</option>
                      <option value="card">Cartão</option>
                      <option value="boleto">Boleto</option>
                      <option value="transfer">Transferência</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Condição">
                    <NativeSelect
                      onChange={(value) => setCondition(value as PaymentCondition)}
                      value={condition}
                    >
                      <option value="cash">À vista</option>
                      <option value="installments">Parcelado</option>
                      <option value="recurring">Recorrente</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Parcelas / ciclos">
                    <Input
                      className="sales-ops-num bg-[#fafafb]"
                      min={1}
                      onChange={(event) => setInstallments(event.target.value)}
                      type="number"
                      value={installments}
                    />
                  </Field>
                  <Field label="Data-base">
                    <Input
                      className="sales-ops-num bg-[#fafafb]"
                      onChange={(event) => setBaseDate(event.target.value)}
                      type="date"
                      value={baseDate}
                    />
                  </Field>
                </div>
              </div>

              <div className={`${panelClass} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[13px] font-bold">Custos, margem e prestadores</div>
                  <SecondaryButton
                    onClick={() =>
                      setProfessionals((current) => [
                        ...current,
                        {
                          personId: collaborators[0]?.id ?? '',
                          personName: collaborators[0]?.displayName ?? '',
                          role: 'Operacional',
                          costBrl: '0.00',
                        },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Prestador
                  </SecondaryButton>
                </div>
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <Field label="Outros custos (R$)">
                    <Input
                      className="sales-ops-num bg-[#fafafb]"
                      onChange={(event) => setOtherCostsBrl(event.target.value)}
                      value={otherCostsBrl}
                    />
                  </Field>
                  <Field label="Com. vendedor %">
                    <Input
                      className="sales-ops-num bg-[#fafafb]"
                      onChange={(event) => setSellerCommissionPct(event.target.value)}
                      value={sellerCommissionPct}
                    />
                  </Field>
                  <Field label="Com. finder %">
                    <Input
                      className="sales-ops-num bg-[#fafafb]"
                      onChange={(event) => setFinderCommissionPct(event.target.value)}
                      value={finderCommissionPct}
                    />
                  </Field>
                  <Field label="Imposto %">
                    <Input
                      className="sales-ops-num bg-[#fafafb]"
                      onChange={(event) => setTaxPct(event.target.value)}
                      value={taxPct}
                    />
                  </Field>
                </div>
                {professionals.length > 0 ? (
                  <div className="mb-4 grid gap-2">
                    {professionals.map((professional, index) => (
                      <div
                        className="grid gap-2 md:grid-cols-[1fr_150px_130px_34px]"
                        key={`${professional.personId}-${index}`}
                      >
                        <NativeSelect
                          onChange={(value) => {
                            const person = collaborators.find((candidate) => candidate.id === value);
                            setProfessionals((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      personId: value,
                                      personName: person?.displayName ?? '',
                                    }
                                  : item,
                              ),
                            );
                          }}
                          value={professional.personId}
                        >
                          <option value="">Digite manualmente</option>
                          {collaborators.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.displayName}
                            </option>
                          ))}
                        </NativeSelect>
                        <Input
                          className="bg-[#fafafb]"
                          onChange={(event) =>
                            setProfessionals((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, role: event.target.value } : item,
                              ),
                            )
                          }
                          value={professional.role}
                        />
                        <Input
                          className="sales-ops-num bg-[#fafafb]"
                          onChange={(event) =>
                            setProfessionals((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, costBrl: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          value={professional.costBrl}
                        />
                        <button
                          className={iconButtonClass}
                          onClick={() =>
                            setProfessionals((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-2xl bg-[#18181b] p-5 text-[#f3f3f5]">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[13px] font-semibold text-[#9b9ba3]">Margem líquida</div>
                      <div className="mt-1 flex items-baseline gap-3">
                        <span
                          className={`sales-ops-num text-[30px] font-bold ${marginCents >= 0 ? 'text-[#8fd19e]' : 'text-[#f08b72]'}`}
                        >
                          {formatMoneyBrl(marginCents, { maximumFractionDigits: 0 })}
                        </span>
                        <span
                          className={`sales-ops-num text-[17px] font-bold ${marginCents >= 0 ? 'text-[#8fd19e]' : 'text-[#f08b72]'}`}
                        >
                          ({marginPct}%)
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-[12.5px] leading-7 text-[#c9c9d0]">
                      <div>
                        Comissão vendedor ·{' '}
                        <span className="sales-ops-num font-semibold text-[#f3f3f5]">
                          {formatMoneyBrl(sellerCommissionCents, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        Comissão finder ·{' '}
                        <span className="sales-ops-num font-semibold text-[#f3f3f5]">
                          {formatMoneyBrl(finderCommissionCents, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        Custos + imposto ·{' '}
                        <span className="sales-ops-num font-semibold text-[#f3f3f5]">
                          {formatMoneyBrl(professionalCents + taxCents + otherCents, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Field label="Observações">
                <textarea
                  className="min-h-[74px] rounded-md border border-[#dcdce2] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#eaa81a]"
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </Field>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[#e8e8ec] bg-white px-[26px] py-4">
          <SecondaryButton onClick={onClose}>
            <ChevronLeft className="h-4 w-4" />
            Fechar
          </SecondaryButton>
          <div className="flex items-center gap-3">
            <span className="sales-ops-num text-[24px] font-bold text-[#9c7210]">
              {formatMoneyBrl(totalCents, { maximumFractionDigits: 0 })}
            </span>
            <SecondaryButton disabled={!canSave || saving} onClick={() => submit('draft')}>
              Salvar incompleto
            </SecondaryButton>
            <PrimaryButton disabled={!canSave || saving} onClick={() => submit('closed')}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar venda
            </PrimaryButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
