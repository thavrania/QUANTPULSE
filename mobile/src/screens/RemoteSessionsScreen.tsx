import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme/colors';
import { useMobileApp } from '../context/MobileAppContext';
import { ActiveSessionItem } from '../types/mobile';
import * as Haptics from 'expo-haptics';

export function RemoteSessionsScreen() {
  const {
    activeSessions,
    refreshSessions,
    killRemoteBrowser,
    killAllOtherBrowsers,
  } = useMobileApp();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [killingId, setKillingId] = useState<string | null>(null);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await refreshSessions();
    setIsRefreshing(false);
  };

  const handleKill = (session: ActiveSessionItem) => {
    Alert.alert(
      'Kill Remote Browser',
      `Terminate session on "${session.device}" (${session.ip}) immediately?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'KILL BROWSER',
          style: 'destructive',
          onPress: async () => {
            setKillingId(session.id);
            const ok = await killRemoteBrowser(session.id);
            setKillingId(null);
            if (ok) {
              Alert.alert('Session Terminated', 'Remote browser was disconnected.');
            }
          },
        },
      ]
    );
  };

  const handleKillAllOthers = () => {
    Alert.alert(
      'Kill All Other Browsers',
      'This will instantly lock and disconnect ALL other browsers and workstations. Only this mobile app will remain logged in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'KILL ALL OTHERS',
          style: 'destructive',
          onPress: async () => {
            const ok = await killAllOtherBrowsers();
            if (ok) {
              Alert.alert('Success', 'All remote browsers terminated.');
            }
          },
        },
      ]
    );
  };

  const remoteSessions = activeSessions.filter((s) => !s.isCurrent && s.status === 'ACTIVE');

  const renderSessionCard = ({ item }: { item: ActiveSessionItem }) => {
    const isCurrent = item.isCurrent;
    const isKilled = item.status === 'KILLED';
    const isKilling = killingId === item.id;

    return (
      <View
        style={[
          styles.card,
          isCurrent && styles.currentCard,
          isKilled && styles.killedCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceIcon}>
              {item.device.includes('iPhone') || item.device.includes('Android') ? '📱' : '💻'}
            </Text>
            <View>
              <Text style={styles.deviceName}>{item.device}</Text>
              <Text style={styles.sessionMeta}>
                IP: {item.ip} • User: {item.username}
              </Text>
            </View>
          </View>

          {isCurrent ? (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>THIS PHONE</Text>
            </View>
          ) : isKilled ? (
            <View style={styles.killedBadge}>
              <Text style={styles.killedBadgeText}>TERMINATED</Text>
            </View>
          ) : (
            <View style={styles.remoteBadge}>
              <Text style={styles.remoteBadgeText}>REMOTE</Text>
            </View>
          )}
        </View>

        {!isCurrent && !isKilled && (
          <TouchableOpacity
            style={styles.killButton}
            onPress={() => handleKill(item)}
            disabled={isKilling}
          >
            {isKilling ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.killButtonText}>🔴 KILL BROWSER</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Warning Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>TERMINAL SECURITY GUARD</Text>
        <Text style={styles.bannerSubtitle}>
          {remoteSessions.length > 0
            ? `⚠️ ${remoteSessions.length} remote browser(s) are currently running QuantPulse.`
            : '✅ No remote browser sessions active. You are secure.'}
        </Text>

        {remoteSessions.length > 0 && (
          <TouchableOpacity
            style={styles.killAllButton}
            onPress={handleKillAllOthers}
          >
            <Text style={styles.killAllButtonText}>
              🚨 KILL ALL OTHER BROWSERS
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={activeSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSessionCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.cyan}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading active sessions...</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  banner: {
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 16,
  },
  bannerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.cyanLight,
    letterSpacing: 1,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  killAllButton: {
    backgroundColor: colors.rose,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  killAllButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  currentCard: {
    borderColor: colors.cyan,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  killedCard: {
    opacity: 0.5,
    borderColor: colors.rose,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  deviceIcon: {
    fontSize: 24,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sessionMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  currentBadge: {
    backgroundColor: colors.cyanGlow,
    borderColor: colors.cyan,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.cyanLight,
  },
  remoteBadge: {
    backgroundColor: colors.amberGlow,
    borderColor: colors.amber,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  remoteBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.amberLight,
  },
  killedBadge: {
    backgroundColor: colors.roseGlow,
    borderColor: colors.rose,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  killedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.roseLight,
  },
  killButton: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: colors.rose,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  killButtonText: {
    color: colors.roseLight,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
