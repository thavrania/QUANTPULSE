import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MobileAppProvider, useMobileApp } from './src/context/MobileAppContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';

function MainAppShell() {
  const { user, isRemoteKilled, setUser } = useMobileApp();

  // If session was terminated remotely
  if (isRemoteKilled) {
    return (
      <SafeAreaView style={styles.killedContainer}>
        <View style={styles.killedCard}>
          <Text style={styles.killedEmoji}>🚫</Text>
          <Text style={styles.killedTitle}>Session Terminated</Text>
          <Text style={styles.killedSubtitle}>
            This terminal session was killed remotely from another workstation. All market feeds and broker order capabilities are disconnected.
          </Text>
          <TouchableOpacity
            style={styles.reloginBtn}
            onPress={() => setUser(null)}
          >
            <Text style={styles.reloginText}>SIGN IN AGAIN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // If unauthenticated, show Biometric & Password Gate
  if (!user) {
    return <AuthScreen />;
  }

  // Authenticated Dashboard
  return <AppNavigator />;
}

export default function App() {
  return (
    <MobileAppProvider>
      <StatusBar style="light" />
      <MainAppShell />
    </MobileAppProvider>
  );
}

const styles = StyleSheet.create({
  killedContainer: {
    flex: 1,
    backgroundColor: colors.obsidian,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  killedCard: {
    backgroundColor: colors.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.rose,
    padding: 24,
    alignItems: 'center',
    shadowColor: colors.rose,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  killedEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  killedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  killedSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  reloginBtn: {
    backgroundColor: colors.rose,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  reloginText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
});
