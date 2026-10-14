import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { colors } from '../theme/colors';
import { useMobileApp } from '../context/MobileAppContext';
import { RadarScreenerScreen } from '../screens/RadarScreenerScreen';
import { NextActionScreen } from '../screens/NextActionScreen';
import { PositionsScreen } from '../screens/PositionsScreen';
import { RemoteSessionsScreen } from '../screens/RemoteSessionsScreen';
import * as Haptics from 'expo-haptics';

type Tab = 'RADAR' | 'TRADE' | 'POSITIONS' | 'SESSIONS';

export function AppNavigator() {
  const { user, logout, activeSessionsCount, setSelectedTicker } = useMobileApp();
  const [activeTab, setActiveTab] = useState<Tab>('RADAR');

  const handleSelectStock = (stock: any) => {
    setSelectedTicker(stock.ticker);
    setActiveTab('TRADE');
  };

  const handleOrderSuccess = () => {
    setActiveTab('POSITIONS');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'RADAR':
        return <RadarScreenerScreen onSelectStock={handleSelectStock} />;
      case 'TRADE':
        return <NextActionScreen onOrderSuccess={handleOrderSuccess} />;
      case 'POSITIONS':
        return <PositionsScreen />;
      case 'SESSIONS':
        return <RemoteSessionsScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.obsidian} />

      {/* Top Application Header */}
      <View style={styles.header}>
        <View style={styles.brandGroup}>
          <Text style={styles.brandIcon}>⚡</Text>
          <View>
            <Text style={styles.brandTitle}>QuantPulse</Text>
            <Text style={styles.brandSubtitle}>20D Vol & Options Terminal</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Workstations Active Counter */}
          <TouchableOpacity
            style={[
              styles.sessionBadge,
              activeSessionsCount > 1 && styles.sessionBadgeAmber,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('SESSIONS');
            }}
          >
            <View
              style={[
                styles.dot,
                activeSessionsCount > 1 ? styles.dotAmber : styles.dotEmerald,
              ]}
            />
            <Text style={styles.sessionBadgeText}>
              {activeSessionsCount} {activeSessionsCount === 1 ? 'Browser' : 'Browsers'}
            </Text>
          </TouchableOpacity>

          {/* User Lock / Logout */}
          <TouchableOpacity
            style={styles.lockBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              logout();
            }}
          >
            <Text style={styles.lockText}>🔒 Lock</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Active Tab Screen */}
      <View style={styles.body}>{renderContent()}</View>

      {/* Bottom Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'RADAR' && styles.tabItemActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('RADAR');
          }}
        >
          <Text style={styles.tabIcon}>📡</Text>
          <Text style={[styles.tabLabel, activeTab === 'RADAR' && styles.tabLabelActive]}>
            Radar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'TRADE' && styles.tabItemActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('TRADE');
          }}
        >
          <Text style={styles.tabIcon}>⚡</Text>
          <Text style={[styles.tabLabel, activeTab === 'TRADE' && styles.tabLabelActive]}>
            Trade
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'POSITIONS' && styles.tabItemActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('POSITIONS');
          }}
        >
          <Text style={styles.tabIcon}>💼</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'POSITIONS' && styles.tabLabelActive,
            ]}
          >
            Trades
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'SESSIONS' && styles.tabItemActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('SESSIONS');
          }}
        >
          <Text style={styles.tabIcon}>🖥️</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'SESSIONS' && styles.tabLabelActive,
            ]}
          >
            Workstations
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    fontSize: 22,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    color: colors.cyanLight,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.obsidian,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sessionBadgeAmber: {
    borderColor: colors.amber,
    backgroundColor: colors.amberGlow,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotEmerald: {
    backgroundColor: colors.emerald,
  },
  dotAmber: {
    backgroundColor: colors.amber,
  },
  sessionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  lockBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  lockText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.roseLight,
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingBottom: 14,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabItemActive: {
    opacity: 1,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.cyanLight,
    fontWeight: '800',
  },
});
