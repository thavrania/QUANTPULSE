export type CrossoverDirection = 'BULLISH' | 'BEARISH' | 'NONE';

export interface StockRadarItem {
  ticker: string;
  name: string;
  spotPrice: number;
  dayChangePercent: number;
  todayTradedShares: number;
  avg20dShares: number;
  volumeRatio: number; // today / 20d
  hasCrossed20D: boolean;
  crossoverDirection: CrossoverDirection;
  crossoverTime?: string;
  atmCallStrike?: number;
  atmPutStrike?: number;
  atmCallLtp?: number;
  atmPutLtp?: number;
  lotSize: number;
}

export type TslMilestone = 'NONE' | 'L1_BREAKEVEN' | 'L2_TRAILED_10' | 'L3_TARGET_LOCKED';

export interface PositionItem {
  id: string;
  ticker: string;
  strike: number;
  optionType: 'CE' | 'PE';
  entryPrice: number;
  currentLtp: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  tslMilestone: TslMilestone;
  stopLossPrice: number;
  targetPrice: number;
  entryTime: string;
}

export interface ActiveSessionItem {
  id: string;
  username: string;
  createdAt: number;
  lastActive: number;
  ip: string;
  device: string;
  status: 'ACTIVE' | 'KILLED';
  isCurrent?: boolean;
}

export interface MobileUserSession {
  username: string;
  token?: string;
  biometricEnabled: boolean;
}
