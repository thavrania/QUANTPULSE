import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { useMobileApp } from '../context/MobileAppContext';
import { StockRadarItem } from '../types/mobile';
import * as Haptics from 'expo-haptics';

interface Props {
  onOrderSuccess: () => void;
}

export function NextActionScreen({ onOrderSuccess }: Props) {
  const { selectedStock, executeOptionOrder } = useMobileApp();

  const [optionType, setOptionType] = useState<'CE' | 'PE'>('CE');
  const [capital, setCapital] = useState<number>(50000);
  const [isExecuting, setIsExecuting] = useState(false);

  if (!selectedStock) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No stock selected. Select a stock from Radar.</Text>
      </View>
    );
  }

  const strike = optionType === 'CE' ? selectedStock.atmCallStrike || selectedStock.spotPrice : selectedStock.atmPutStrike || selectedStock.spotPrice;
  const ltp = optionType === 'CE' ? selectedStock.atmCallLtp || 40.0 : selectedStock.atmPutLtp || 35.0;
  const lotSize = selectedStock.lotSize || 250;

  // Calculate lots based on capital
  const costPerLot = ltp * lotSize;
  const calculatedLots = Math.max(1, Math.floor(capital / Math.max(1, costPerLot)));
  const totalQuantity = calculatedLots * lotSize;
  const totalMarginRequired = totalQuantity * ltp;

  const stopLossPrice = Math.round(ltp * 0.85 * 10) / 10;
  const targetPrice = Math.round(ltp * 1.3 * 10) / 10;

  const handleExecute = async () => {
    try {
      setIsExecuting(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const success = await executeOptionOrder({
        ticker: selectedStock.ticker,
        strike: Math.round(strike),
        optionType,
        quantity: totalQuantity,
        price: ltp,
      });

      if (success) {
        Alert.alert(
          'Order Dispatched',
          `Institutional Buy Order placed for ${totalQuantity} qty of ${selectedStock.ticker} ${strike} ${optionType} @ ₹${ltp.toFixed(1)}.\n\nTrailing Stop-Loss guard active.`,
          [{ text: 'View Positions', onPress: onOrderSuccess }]
        );
      } else {
        Alert.alert('Execution Error', 'Failed to route order to Dhan HQ broker.');
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stock Spot Banner */}
      <View style={styles.stockBanner}>
        <View>
          <Text style={styles.ticker}>{selectedStock.ticker}</Text>
          <Text style={styles.companyName}>{selectedStock.name}</Text>
        </View>
        <View style={styles.alignRight}>
          <Text style={styles.spotPrice}>₹{selectedStock.spotPrice.toFixed(2)}</Text>
          <Text
            style={[
              styles.changePercent,
              selectedStock.dayChangePercent >= 0 ? styles.posText : styles.negText,
            ]}
          >
            {selectedStock.dayChangePercent >= 0 ? '+' : ''}
            {selectedStock.dayChangePercent.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Directional Toggle: CALL vs PUT */}
      <View style={styles.directionToggleRow}>
        <TouchableOpacity
          style={[styles.directionBtn, optionType === 'CE' && styles.directionBtnCall]}
          onPress={() => {
            Haptics.selectionAsync();
            setOptionType('CE');
          }}
        >
          <Text
            style={[
              styles.directionBtnText,
              optionType === 'CE' && styles.directionBtnTextCall,
            ]}
          >
            ▲ BUY CALL (CE)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.directionBtn, optionType === 'PE' && styles.directionBtnPut]}
          onPress={() => {
            Haptics.selectionAsync();
            setOptionType('PE');
          }}
        >
          <Text
            style={[
              styles.directionBtnText,
              optionType === 'PE' && styles.directionBtnTextPut,
            ]}
          >
            ▼ BUY PUT (PE)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contract Strike Card */}
      <View style={styles.contractCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardHeaderLabel}>ACTIVE OPTION CONTRACT</Text>
          <View style={styles.atmBadge}>
            <Text style={styles.atmBadgeText}>ATM STRIKE</Text>
          </View>
        </View>

        <View style={styles.contractMainRow}>
          <Text style={styles.contractTitle}>
            {selectedStock.ticker} {Math.round(strike)} {optionType}
          </Text>
          <Text style={styles.contractLtp}>₹{ltp.toFixed(2)}</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Lot Size</Text>
            <Text style={styles.metricVal}>{lotSize}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Stop-Loss (-15%)</Text>
            <Text style={[styles.metricVal, styles.negText]}>₹{stopLossPrice}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Target (+30%)</Text>
            <Text style={[styles.metricVal, styles.posText]}>₹{targetPrice}</Text>
          </View>
        </View>
      </View>

      {/* Capital Allocation Selector */}
      <View style={styles.capitalSection}>
        <Text style={styles.sectionLabel}>CAPITAL ALLOCATION</Text>
        <View style={styles.chipsRow}>
          {[25000, 50000, 100000, 200000].map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[styles.chip, capital === amt && styles.chipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setCapital(amt);
              }}
            >
              <Text style={[styles.chipText, capital === amt && styles.chipTextActive]}>
                ₹{(amt / 1000).toFixed(0)}k
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.orderSummaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Lots to Trade:</Text>
            <Text style={styles.summaryVal}>
              {calculatedLots} Lot{calculatedLots > 1 ? 's' : ''} ({totalQuantity} shares)
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated Margin:</Text>
            <Text style={styles.summaryValHighlight}>₹{totalMarginRequired.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Execution Action Button */}
      <TouchableOpacity
        style={[
          styles.executeButton,
          optionType === 'CE' ? styles.execCall : styles.execPut,
        ]}
        onPress={handleExecute}
        disabled={isExecuting}
      >
        {isExecuting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.executeButtonText}>
            ⚡ EXECUTE 1-TAP {optionType} ORDER
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.guardNote}>
        <Text style={styles.guardNoteText}>
          🛡️ Trailing Stop-Loss Engine will automatically shift SL to Break-Even at +10% profit and trail to +10% at +20% profit.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.obsidian,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  stockBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  ticker: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  companyName: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  spotPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  changePercent: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  posText: {
    color: colors.emeraldLight,
  },
  negText: {
    color: colors.roseLight,
  },
  directionToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  directionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  directionBtnCall: {
    backgroundColor: colors.emeraldGlow,
    borderColor: colors.emerald,
  },
  directionBtnPut: {
    backgroundColor: colors.roseGlow,
    borderColor: colors.rose,
  },
  directionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  directionBtnTextCall: {
    color: colors.emeraldLight,
  },
  directionBtnTextPut: {
    color: colors.roseLight,
  },
  contractCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  atmBadge: {
    backgroundColor: colors.cyanGlow,
    borderColor: colors.cyan,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  atmBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.cyanLight,
  },
  contractMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contractTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  contractLtp: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.cyanLight,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  capitalSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.cyanGlow,
    borderColor: colors.cyan,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.cyanLight,
  },
  orderSummaryCard: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  summaryVal: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  summaryValHighlight: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.cyanLight,
  },
  executeButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 4,
  },
  execCall: {
    backgroundColor: '#059669', // Emerald 600
  },
  execPut: {
    backgroundColor: '#E11D48', // Rose 600
  },
  executeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  guardNote: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  guardNoteText: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
