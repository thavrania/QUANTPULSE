import { Stock, SystemConfig, NextActionPayload } from '../types/quant';
import { getVolumeScreenerMetrics } from './crossoverEngine';

export function buildNextActionPayload(stock: Stock, config: SystemConfig, isSimulation?: boolean): NextActionPayload {
  const isSim = isSimulation ?? (stock.feedSource === 'SIMULATED');
  const metrics = getVolumeScreenerMetrics(stock, isSim);
  const cap = config.capitalPerTrade;

  // 1. BUY STOCK (EQUITY) DETAILS
  const eqQty = Math.max(1, Math.floor(cap / stock.spotLtp));
  const eqRiskPts = +(stock.spotLtp * 0.01).toFixed(2); // 1% initial SL
  const eqStopLoss = +(stock.spotLtp - eqRiskPts).toFixed(2);
  const eqTarget = +(stock.spotLtp + eqRiskPts * 2).toFixed(2);

  // 2. BUY OPTION (ATM CALL OPTION CE) DETAILS
  const atmStrike = Math.round(stock.spotLtp / stock.strikeStep) * stock.strikeStep;
  const contractSymbol = `${stock.ticker} ${atmStrike} CE`;
  const premiumLtp = +(stock.spotLtp * 0.0165).toFixed(2); // ~1.65% ATM Call premium
  const singleLotCost = premiumLtp * stock.lotSize;
  const lots = Math.max(1, Math.floor(cap / Math.max(singleLotCost, 1)));
  const totalOptionQty = lots * stock.lotSize;
  const optRiskPts = +(premiumLtp * 0.20).toFixed(2); // 20% Premium SL
  const optStopLoss = +(premiumLtp - optRiskPts).toFixed(2);
  const optTarget = +(premiumLtp + optRiskPts * 2).toFixed(2);

  // Optionability Guardrail: If Cash-Only stock & Option Toggle is ON, fallback to Stock
  const effectiveInstrumentMode =
    config.instrumentMode === 'OPTION' && !stock.isFnO
      ? 'STOCK_FALLBACK'
      : config.instrumentMode;

  return {
    ticker: stock.ticker,
    eligibilityStatus: metrics.statusCode,
    isEligibleForBuy: metrics.isEligibleForBuy,
    volumeTracking: {
      todayVolumeM: stock.todayVolM,
      avgVolume20DM: stock.avgVol20DM,
      crossoverProgressPct: metrics.progressPct,
      rvolRatio: metrics.rvolRatio,
      remainingDeficitM: metrics.deficitM,
      exactCrossoverTime: stock.crossoverTime || 'WAITING_FOR_CROSSOVER',
      crossoverSpotPrice: stock.crossoverSpotPrice || null,
      currentSpotLtp: stock.spotLtp,
    },
    toggleConfiguration: {
      toggle1_Instrument: config.instrumentMode,
      effectiveInstrumentMode,
      toggle2_Execution: config.executionMode,
    },
    stockBuyDetails: {
      instrumentType: 'STOCK (EQUITY)',
      symbol: `${stock.ticker}-EQ`,
      action: 'BUY',
      entryPrice: stock.spotLtp,
      quantity: eqQty,
      riskPerShare: eqRiskPts,
      stopLossPrice: eqStopLoss,
      targetPrice: eqTarget,
      capitalRequired: +(eqQty * stock.spotLtp).toFixed(0),
    },
    optionBuyDetails: stock.isFnO
      ? {
          instrumentType: 'OPTION (ATM CALL)',
          symbol: contractSymbol,
          optionType: 'CE',
          strikePrice: atmStrike,
          expiry: '28-SEP-2026 (Current Expiry)',
          action: 'BUY',
          entryPrice: premiumLtp,
          lotSize: stock.lotSize,
          lots,
          quantity: totalOptionQty,
          delta: 0.52,
          ivPct: stock.ivPct,
          riskPerUnit: optRiskPts,
          stopLossPrice: optStopLoss,
          targetPrice: optTarget,
          capitalRequired: +(totalOptionQty * premiumLtp).toFixed(0),
        }
      : null,
  };
}
