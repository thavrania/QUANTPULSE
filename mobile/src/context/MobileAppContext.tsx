import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { StockRadarItem, PositionItem, ActiveSessionItem } from '../types/mobile';
import { apiService } from '../services/apiService';
import { API_CONFIG } from '../config/apiConfig';
import * as Haptics from 'expo-haptics';

interface MobileAppContextType {
  user: string | null;
  setUser: (u: string | null) => void;
  stocks: StockRadarItem[];
  selectedStock: StockRadarItem | null;
  setSelectedTicker: (ticker: string) => void;
  positions: PositionItem[];
  activeSessions: ActiveSessionItem[];
  activeSessionsCount: number;
  isRemoteKilled: boolean;
  isLoading: boolean;
  refreshMarket: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  executeOptionOrder: (params: {
    ticker: string;
    strike: number;
    optionType: 'CE' | 'PE';
    quantity: number;
    price: number;
  }) => Promise<boolean>;
  panicSquareOff: () => Promise<void>;
  killRemoteBrowser: (sessionId: string) => Promise<boolean>;
  killAllOtherBrowsers: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const MobileAppContext = createContext<MobileAppContextType | undefined>(undefined);

// Initial catalog fallback in case backend is offline
const INITIAL_DEMO_STOCKS: StockRadarItem[] = [
  {
    ticker: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    spotPrice: 2985.4,
    dayChangePercent: 1.85,
    todayTradedShares: 5420000,
    avg20dShares: 4850000,
    volumeRatio: 1.12,
    hasCrossed20D: true,
    crossoverDirection: 'BULLISH',
    crossoverTime: '09:31:12',
    atmCallStrike: 2980,
    atmPutStrike: 2980,
    atmCallLtp: 42.5,
    atmPutLtp: 38.0,
    lotSize: 250,
  },
  {
    ticker: 'TATASTEEL',
    name: 'Tata Steel Limited',
    spotPrice: 158.2,
    dayChangePercent: 2.4,
    todayTradedShares: 32500000,
    avg20dShares: 28000000,
    volumeRatio: 1.16,
    hasCrossed20D: true,
    crossoverDirection: 'BULLISH',
    crossoverTime: '09:34:45',
    atmCallStrike: 160,
    atmPutStrike: 160,
    atmCallLtp: 4.8,
    atmPutLtp: 3.9,
    lotSize: 5500,
  },
  {
    ticker: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    spotPrice: 1642.0,
    dayChangePercent: -0.65,
    todayTradedShares: 14200000,
    avg20dShares: 16500000,
    volumeRatio: 0.86,
    hasCrossed20D: false,
    crossoverDirection: 'NONE',
    atmCallStrike: 1640,
    atmPutStrike: 1640,
    atmCallLtp: 24.1,
    atmPutLtp: 22.8,
    lotSize: 550,
  },
  {
    ticker: 'INFY',
    name: 'Infosys Limited',
    spotPrice: 1876.5,
    dayChangePercent: -1.95,
    todayTradedShares: 9800000,
    avg20dShares: 8200000,
    volumeRatio: 1.2,
    hasCrossed20D: true,
    crossoverDirection: 'BEARISH',
    crossoverTime: '09:41:02',
    atmCallStrike: 1880,
    atmPutStrike: 1880,
    atmCallLtp: 18.5,
    atmPutLtp: 34.0,
    lotSize: 400,
  },
];

export const MobileAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<string | null>(null);
  const [stocks, setStocks] = useState<StockRadarItem[]>(INITIAL_DEMO_STOCKS);
  const [selectedTicker, setSelectedTicker] = useState<string>('RELIANCE');
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>([]);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(1);
  const [isRemoteKilled, setIsRemoteKilled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const selectedStock = stocks.find((s) => s.ticker === selectedTicker) || stocks[0] || null;

  // Fetch live market data
  const refreshMarket = useCallback(async () => {
    try {
      const data = await apiService.getMarketSession();
      if (data && data.success && Array.isArray(data.stocks) && data.stocks.length > 0) {
        setStocks(data.stocks);
      }
    } catch {
      // Backend offline or running in mock mode - keep cached stocks
    }
  }, []);

  // Fetch active remote browser sessions
  const refreshSessions = useCallback(async () => {
    try {
      const data = await apiService.getActiveSessions();
      if (data && data.success && Array.isArray(data.sessions)) {
        setActiveSessions(data.sessions);
        setActiveSessionsCount(data.activeCount || data.sessions.filter((s) => s.status === 'ACTIVE').length);
      }
    } catch {}
  }, []);

  // Periodic heartbeat & session validation
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const sessionCheck = await apiService.checkSession();
        if (sessionCheck.killed) {
          setIsRemoteKilled(true);
          setUser(null);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (sessionCheck.authenticated) {
          if (typeof sessionCheck.activeSessionsCount === 'number') {
            setActiveSessionsCount(sessionCheck.activeSessionsCount);
          }
        }
      } catch {}
    }, API_CONFIG.HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user]);

  // Periodic market data feed polling
  useEffect(() => {
    if (!user) return;
    refreshMarket();
    const interval = setInterval(refreshMarket, API_CONFIG.POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, refreshMarket]);

  // Execute institutional option order
  const executeOptionOrder = async (params: {
    ticker: string;
    strike: number;
    optionType: 'CE' | 'PE';
    quantity: number;
    price: number;
  }): Promise<boolean> => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await apiService.placeOrder(params);
      
      // Add to local positions monitor
      const newPos: PositionItem = {
        id: `pos_${Date.now()}`,
        ticker: params.ticker,
        strike: params.strike,
        optionType: params.optionType,
        entryPrice: params.price,
        currentLtp: params.price,
        quantity: params.quantity,
        pnl: 0,
        pnlPercent: 0,
        tslMilestone: 'NONE',
        stopLossPrice: Math.round(params.price * 0.85 * 10) / 10,
        targetPrice: Math.round(params.price * 1.3 * 10) / 10,
        entryTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };
      setPositions((prev) => [newPos, ...prev]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
  };

  // Panic square-off all open positions
  const panicSquareOff = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await apiService.squareOffAll().catch(() => {});
      setPositions([]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  // Kill specific remote browser
  const killRemoteBrowser = async (sessionId: string): Promise<boolean> => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiService.killSession(sessionId);
      if (res && res.success) {
        await refreshSessions();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Kill all other remote browsers
  const killAllOtherBrowsers = async (): Promise<boolean> => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await apiService.killAllOtherSessions();
      if (res && res.success) {
        await refreshSessions();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await apiService.logout();
    setUser(null);
  };

  return (
    <MobileAppContext.Provider
      value={{
        user,
        setUser,
        stocks,
        selectedStock,
        setSelectedTicker,
        positions,
        activeSessions,
        activeSessionsCount,
        isRemoteKilled,
        isLoading,
        refreshMarket,
        refreshSessions,
        executeOptionOrder,
        panicSquareOff,
        killRemoteBrowser,
        killAllOtherBrowsers,
        logout,
      }}
    >
      {children}
    </MobileAppContext.Provider>
  );
};

export const useMobileApp = () => {
  const ctx = useContext(MobileAppContext);
  if (!ctx) throw new Error('useMobileApp must be used within MobileAppProvider');
  return ctx;
};
