import * as SecureStore from 'expo-secure-store';

/**
 * Clerk token cache — persists JWT in iOS Keychain / Android Keystore via
 * expo-secure-store. Required by ClerkProvider on native.
 *
 * The inline type mirrors @clerk/clerk-expo's TokenCache interface. We avoid
 * importing it directly because the subpath has moved between SDK versions.
 */
type TokenCache = {
  getToken: (key: string) => Promise<string | null | undefined>;
  saveToken: (key: string, value: string) => Promise<void>;
  clearToken?: (key: string) => void;
};

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // best-effort
    }
  },
};
