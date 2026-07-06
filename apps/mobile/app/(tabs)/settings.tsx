import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsTab() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['left', 'right']}>
      <View className="p-6 gap-6">
        <View>
          <Text className="text-2xl font-semibold text-foreground">Configurações</Text>
        </View>

        <View className="bg-card border border-border rounded-xl p-5">
          <Text className="text-sm text-muted-foreground">Autenticação gerenciada pelo Hub.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
