import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';

export default function SettingsTab() {
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['left', 'right']}>
      <View className="p-6 gap-6">
        <View>
          <Text className="text-2xl font-semibold text-foreground">Configurações</Text>
        </View>

        <View className="bg-card border border-border rounded-xl p-5">
          <Text className="text-sm text-muted-foreground">Logado como</Text>
          <Text className="mt-1 text-base font-medium text-foreground">
            {user?.emailAddresses?.[0]?.emailAddress ?? user?.id ?? '—'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => signOut()}
          className="bg-card border border-border rounded-lg py-3 items-center"
        >
          <Text className="text-foreground font-semibold">Sair</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
