import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'qp_biometric_enabled';
const SAVED_USER_KEY = 'qp_saved_username';

export const authService = {
  async checkBiometricsAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  },

  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock QuantPulse Terminal',
        fallbackLabel: 'Use Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  },

  async isBiometricPreferred(): Promise<boolean> {
    try {
      const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async setBiometricPreferred(enabled: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch {}
  },

  async getSavedUsername(): Promise<string> {
    try {
      return (await SecureStore.getItemAsync(SAVED_USER_KEY)) || 'admin';
    } catch {
      return 'admin';
    }
  },

  async saveUsername(username: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(SAVED_USER_KEY, username);
    } catch {}
  },
};
