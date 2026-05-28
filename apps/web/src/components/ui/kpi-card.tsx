import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './card';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

export interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  isLoading?: boolean;
  colorScheme?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  hint?: string;
}

const colorClasses: Record<NonNullable<KPICardProps['colorScheme']>, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-destructive',
};

export function KPICard({
  title,
  value,
  icon: Icon,
  isLoading = false,
  colorScheme = 'default',
  hint,
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon ? <Icon className={cn('h-4 w-4', colorClasses[colorScheme])} /> : null}
        </div>
        <p className={cn('mt-2 text-3xl font-semibold', colorClasses[colorScheme])}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
