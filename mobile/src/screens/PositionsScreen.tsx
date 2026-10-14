import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { useMobileApp } from '../context/MobileAppContext';
import { PositionItem } from '../types/mobile';
import * as Haptics from 'expo-haptics';

export function PositionsScreen() {
  const { positions, panicSquareOff } = useMobileApp();

  const totalPnl = positions.reduce((acc, pos) => acc + pos.pnl, 0);

  const handlePanicSquareOff = () => {
    Alert.alert(
      '🚨 PANIC KILL SWITCH',
      'Square off ALL open derivative positions immediately at market price?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SQUARE OFF ALL',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await panicSquareOff();
          },
        },
      ]
    );
  };

  const renderPositionCard = ({ item }: { item: PositionItem }) => {
    const isProfitable = item.pnl >= 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <View style={styles.symbolRow}>
              <Text style={styles.symbol}>{item.ticker}</Text>
              <View
                style={[
                  styles.typeBadge,
                  item.optionType === 'CE' ? styles.callBadge : styles.putBadge,
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    item.optionType === 'CE' ? styles.callBadgeText : styles.putBadgeText,
                  ]}
                >
                  {item.strike} {item.optionType}
                </Text>
              </View>
            </View>
            <Text style={styles.subtext}>
              {item.quantity} Qty • Entry: ₹{item.entryPrice.toFixed(1)}
            </Text>
          </View>

          <View style={styles.alignRight}>
            <Text
              style={[
                styles.pnlText,
                isProfitable ? styles.posText : styles.negText,
              ]}
            >
              {isProfitable ? '+' : ''}₹{item.pnl.toLocaleString()}
            </Text>
            <Text
              style={[
                styles.pnlPercent,
                isProfitable ? styles.posText : styles.negText,
              ]}
            >
              {isProfitable ? '+' : ''}
              {item.pnlPercent.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Milestone Tracker Bar */}
        <View style={styles.milestoneRow}>
          <View
            style={[
              styles.milestoneStep,
              item.tslMilestone !== 'NONE' && styles.stepActive,
            ]}
          >
            <Text style={styles.stepText}>L1: B/E</Text>
          </View>
          <View
            style={[
              styles.milestoneStep,
              (item.tslMilestone === 'L2_TRAILED_10' ||
                item.tslMilestone === 'L3_TARGET_LOCKED') &&
                styles.stepActive,
            ]}
          >
            <Text style={styles.stepText}>L2: +10%</Text>
          </View>
          <View
            style={[
              styles.milestoneStep,
              item.tslMilestone === 'L3_TARGET_LOCKED' && styles.stepActive,
            ]}
          >
            <Text style={styles.stepText}>L3: TARGET</Text>
          </View>
        </View>

        {/* Prices Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerPrice}>LTP: ₹{item.currentLtp.toFixed(1)}</Text>
          <Text style={styles.footerPrice}>SL: ₹{item.stopLossPrice.toFixed(1)}</Text>
          <Text style={styles.footerPrice}>Target: ₹{item.targetPrice.toFixed(1)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* P&L Overview Banner */}
      <View style={styles.pnlBanner}>
        <Text style={styles.pnlBannerLabel}>NET DERIVATIVES P&L</Text>
        <Text
          style={[
            styles.totalPnlText,
            totalPnl >= 0 ? styles.posText : styles.negText,
          ]}
        >
          {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString()}
        </Text>
        <Text style={styles.activeCountText}>
          {positions.length} Active Position{positions.length === 1 ? '' : 's'} Under TSL Guard
        </Text>
      </View>

      {/* Position List */}
      <FlatList
        data={positions}
        keyExtractor={(item) => item.id}
        renderItem={renderPositionCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Active Positions</Text>
            <Text style={styles.emptySubtitle}>
              Execute a 20D volume crossover option from the Radar screener.
            </Text>
          </View>
        }
      />

      {/* Panic Square-Off Button */}
      {positions.length > 0 && (
        <View style={styles.panicContainer}>
          <TouchableOpacity
            style={styles.panicButton}
            onPress={handlePanicSquareOff}
            activeOpacity={0.8}
          >
            <Text style={styles.panicButtonText}>🚨 PANIC SQUARE OFF ALL</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  pnlBanner: {
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 16,
    alignItems: 'center',
  },
  pnlBannerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  totalPnlText: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  activeCountText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  callBadge: {
    backgroundColor: colors.emeraldGlow,
    borderColor: colors.emerald,
    borderWidth: 1,
  },
  putBadge: {
    backgroundColor: colors.roseGlow,
    borderColor: colors.rose,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  callBadgeText: {
    color: colors.emeraldLight,
  },
  putBadgeText: {
    color: colors.roseLight,
  },
  subtext: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  pnlText: {
    fontSize: 16,
    fontWeight: '800',
  },
  pnlPercent: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  posText: {
    color: colors.emeraldLight,
  },
  negText: {
    color: colors.roseLight,
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  milestoneStep: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.obsidian,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  stepActive: {
    backgroundColor: colors.emeraldGlow,
    borderColor: colors.emerald,
  },
  stepText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerPrice: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  panicContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    backgroundColor: colors.obsidian,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  panicButton: {
    backgroundColor: colors.rose,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  panicButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
