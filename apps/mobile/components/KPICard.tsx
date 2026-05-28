import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface KPICardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
}

export function KPICard({ title, value, icon: Icon, hint }: KPICardProps) {
  return (
    <View className="bg-card border border-border rounded-xl p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-muted-foreground">{title}</Text>
        {Icon ? <Icon size={16} color="#2563eb" /> : null}
      </View>
      <Text className="mt-2 text-3xl font-semibold text-foreground">{value}</Text>
      {hint ? <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}
