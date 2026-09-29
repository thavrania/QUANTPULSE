// =====================================================================
// QUANTPULSE — Universal Broker Gateway Type Definitions
// =====================================================================

export type BrokerType = 'DHAN' | 'ZERODHA' | 'PAPER';

export type BrokerConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface BrokerCredentials {
  brokerType: BrokerType;
  clientId: string;
  accessToken: string;
  pinOrTotp?: string;
  isPaperTrading: boolean;
}

export interface LiveMarketTick {
  ticker: string;
  securityId: string;
  ltp: number;
  cumulativeVolume: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  timestamp: string; // HH:MM:SS IST
}

export interface HistoricalDailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BaselineCalculationResult {
  ticker: string;
  securityId: string;
  avgVolume20DM: number; // in Millions
  historicalDaysFetched: number;
  rawVolumes: number[];
  calculatedAt: string;
}

export interface BrokerConnectionTestResult {
  success: boolean;
  message: string;
  broker: BrokerType;
  clientName?: string;
  availableCash?: number;
  latencyMs?: number;
}
