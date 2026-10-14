import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme/colors';
import { useMobileApp } from '../context/MobileAppContext';
import { StockRadarItem } from '../types/mobile';
import * as Haptics from 'expo-haptics';

interface Props {
  onSelectStock: (stock: StockRadarItem) => void;
}

export function RadarScreenerScreen({ onSelectStock }: Props) {
  const { stocks, refreshMarket, activeSessionsCount } = useMobileApp();
  const [filter, setFilter] = useState<'ALL' | 'CROSSED' | 'NEAR'>('ALL');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshMarket();
    setIsRefreshing(false);
  };

  const filteredStocks = stocks.filter((stock) => {
    const matchesSearch =
      stock.ticker.toLowerCase().includes(search.toLowerCase()) ||
      stock.name.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'CROSSED') return stock.hasCrossed20D;
    if (filter === 'NEAR') return !stock.hasCrossed20D && stock.volumeRatio >= 0.8;
    return true;
  });

  const crossedCount = stocks.filter((s) => s.hasCrossed20D).length;
  const nearCount = stocks.filter((s) => !s.hasCrossed20D && s.volumeRatio >= 0.8).length;

  const formatShares = (val: number) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toLocaleString();
  };

  const renderStockCard = ({ item }: { item: StockRadarItem }) => {
    const progressPercent = Math.min(100, Math.round(item.volumeRatio * 100));
    const isBullish = item.crossoverDirection === 'BULLISH';
    const isBearish = item.crossoverDirection === 'BEARISH';

    return (
      <TouchableOpacity
        style={[
          styles.stockCard,
          item.hasCrossed20D && (isBearish ? styles.bearishCard : styles.bullishCard),
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSelectStock(item);
        }}
        activeOpacity={0.7}
      >
        {/* Top Row: Symbol, Spot Price, Day Change */}
        <View style={styles.cardHeader}>
          <View style={styles.symbolGroup}>
            <Text style={styles.symbolText}>{item.ticker}</Text>
            {item.hasCrossed20D ? (
              <View
                style={[
                  styles.badge,
                  isBearish ? styles.bearishBadge : styles.bullishBadge,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isBearish ? styles.bearishBadgeText : styles.bullishBadgeText,
                  ]}
                >
                  {isBearish ? '▼ BREAKDOWN' : '▲ 20D CROSSED'}
                </Text>
              </View>
            ) : item.volumeRatio >= 0.8 ? (
              <View style={[styles.badge, styles.nearBadge]}>
                <Text style={[styles.badgeText, styles.nearBadgeText]}>⚡ NEAR CROSS</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.priceGroup}>
            <Text style={styles.spotPriceText}>₹{item.spotPrice.toFixed(2)}</Text>
            <Text
              style={[
                styles.changeText,
                item.dayChangePercent >= 0 ? styles.posText : styles.negText,
              ]}
            >
              {item.dayChangePercent >= 0 ? '+' : ''}
              {item.dayChangePercent.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Volume Metric Bar */}
        <View style={styles.volumeProgressWrapper}>
          <View style={styles.volumeLabels}>
            <Text style={styles.volLabel}>
              Today: <Text style={styles.volValue}>{formatShares(item.todayTradedShares)}</Text>
            </Text>
            <Text style={styles.volLabel}>
              20D Avg: <Text style={styles.volValue}>{formatShares(item.avg20dShares)}</Text>
            </Text>
            <Text
              style={[
                styles.ratioText,
                item.hasCrossed20D ? styles.posText : styles.neutralText,
              ]}
            >
              {Math.round(item.volumeRatio * 100)}%
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%` },
                item.hasCrossed20D
                  ? isBearish
                    ? styles.fillBearish
                    : styles.fillBullish
                  : item.volumeRatio >= 0.8
                  ? styles.fillNear
                  : styles.fillNormal,
              ]}
            />
          </View>
        </View>

        {/* Bottom Metadata & Crossover Time */}
        <View style={styles.cardFooter}>
          <Text style={styles.metaText}>Lot: {item.lotSize}</Text>
          {item.crossoverTime && (
            <Text style={styles.crossTimeText}>🕒 Crossed at {item.crossoverTime}</Text>
          )}
          <Text style={styles.tapActionText}>Tap to Trade Options →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search 55+ F&O stocks..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'ALL' && styles.filterChipActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.filterChipText, filter === 'ALL' && styles.filterChipTextActive]}>
            All ({stocks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === 'CROSSED' && styles.filterChipActiveCrossed,
          ]}
          onPress={() => setFilter('CROSSED')}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'CROSSED' && styles.filterChipTextActiveCrossed,
            ]}
          >
            🔥 Crossed ({crossedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'NEAR' && styles.filterChipActiveNear]}
          onPress={() => setFilter('NEAR')}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'NEAR' && styles.filterChipTextActiveNear,
            ]}
          >
            ⚡ Near (&gt;80%) ({nearCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stock List */}
      <FlatList
        data={filteredStocks}
        keyExtractor={(item) => item.ticker}
        renderItem={renderStockCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.cyan}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No stocks matching filter criteria</Text>
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
  searchContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchInput: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.cyanGlow,
    borderColor: colors.cyan,
  },
  filterChipActiveCrossed: {
    backgroundColor: colors.emeraldGlow,
    borderColor: colors.emerald,
  },
  filterChipActiveNear: {
    backgroundColor: colors.amberGlow,
    borderColor: colors.amber,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.cyanLight,
  },
  filterChipTextActiveCrossed: {
    color: colors.emeraldLight,
  },
  filterChipTextActiveNear: {
    color: colors.amberLight,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 10,
  },
  stockCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  bullishCard: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(11, 19, 43, 0.95)',
  },
  bearishCard: {
    borderColor: 'rgba(244, 63, 94, 0.4)',
    backgroundColor: 'rgba(11, 19, 43, 0.95)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  symbolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  bullishBadge: {
    backgroundColor: colors.emeraldGlow,
    borderColor: colors.emerald,
  },
  bullishBadgeText: {
    color: colors.emeraldLight,
  },
  bearishBadge: {
    backgroundColor: colors.roseGlow,
    borderColor: colors.rose,
  },
  bearishBadgeText: {
    color: colors.roseLight,
  },
  nearBadge: {
    backgroundColor: colors.amberGlow,
    borderColor: colors.amber,
  },
  nearBadgeText: {
    color: colors.amberLight,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  priceGroup: {
    alignItems: 'flex-end',
  },
  spotPriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  changeText: {
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
  neutralText: {
    color: colors.textSecondary,
  },
  volumeProgressWrapper: {
    marginTop: 10,
  },
  volumeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  volLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  volValue: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ratioText: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: colors.obsidian,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  fillNormal: {
    backgroundColor: colors.textMuted,
  },
  fillNear: {
    backgroundColor: colors.amber,
  },
  fillBullish: {
    backgroundColor: colors.emerald,
  },
  fillBearish: {
    backgroundColor: colors.rose,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  crossTimeText: {
    fontSize: 10,
    color: colors.cyanLight,
    fontWeight: '600',
  },
  tapActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.cyanLight,
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
