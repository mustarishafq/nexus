import { NativeBiometric } from 'capacitor-native-biometric';
import { isNativePlatform } from '@/lib/capacitor/platform';

const CREDENTIAL_SERVER = 'com.emzi.nexus';

export async function isBiometricsAvailable() {
  if (!isNativePlatform()) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

/** Prompts Face ID / Touch ID / fingerprint and resolves true if verified. */
export async function verifyIdentity({ reason = 'Sign in to EMZI Nexus Brain' } = {}) {
  if (!isNativePlatform()) return false;

  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'Biometric login',
      subtitle: 'EMZI Nexus Brain',
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Stores the user's credentials in the OS secure keystore/keychain. */
export async function saveBiometricCredentials({ username, password }) {
  if (!isNativePlatform()) return;
  await NativeBiometric.setCredentials({ username, password, server: CREDENTIAL_SERVER });
}

export async function getBiometricCredentials() {
  if (!isNativePlatform()) return null;
  try {
    return await NativeBiometric.getCredentials({ server: CREDENTIAL_SERVER });
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials() {
  if (!isNativePlatform()) return;
  try {
    await NativeBiometric.deleteCredentials({ server: CREDENTIAL_SERVER });
  } catch {
    // Nothing stored — ignore.
  }
}
