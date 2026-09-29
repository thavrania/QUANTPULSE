// =====================================================================
// QUANTPULSE — Black-Scholes Options Pricing & Greeks Engine
// Institutional Black-Scholes 73 Model for European/Indian Style Index & Stock Options
// =====================================================================

/**
 * Standard normal cumulative distribution function (CDF) via Abramowitz & Stegun approximation.
 */
function standardNormalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Standard normal probability density function (PDF).
 */
function standardNormalPdf(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export interface BlackScholesInput {
  spotPrice: number; // Current spot LTP (S)
  strikePrice: number; // Strike Price (K)
  timeToExpiryYears: number; // Time to expiration in years (T)
  volatility: number; // Annualized Implied Volatility (e.g. 0.20 for 20%) (sigma)
  riskFreeRate?: number; // Risk-free interest rate (default 0.068 = 6.8% RBI Repo)
}

export interface OptionGreeks {
  theoreticalPrice: number;
  delta: number;
  gamma: number;
  theta: number; // Daily theta decay
  vega: number; // Per 1% IV change
  intrinsicValue: number;
  timeValue: number;
}

/**
 * Computes Call Option theoretical price and all 4 primary Greeks.
 */
export function calculateCallGreeks(input: BlackScholesInput): OptionGreeks {
  const {
    spotPrice: S,
    strikePrice: K,
    timeToExpiryYears: T,
    volatility: sigma,
    riskFreeRate: r = 0.068,
  } = input;

  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    const intrinsic = Math.max(0, S - K);
    return {
      theoreticalPrice: intrinsic,
      delta: S > K ? 1.0 : 0.0,
      gamma: 0,
      theta: 0,
      vega: 0,
      intrinsicValue: intrinsic,
      timeValue: 0,
    };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const nd1 = standardNormalCdf(d1);
  const nd2 = standardNormalCdf(d2);
  const npd1 = standardNormalPdf(d1);

  // Theoretical Call Price
  const callPrice = S * nd1 - K * Math.exp(-r * T) * nd2;

  // Greeks
  const delta = +nd1.toFixed(3);
  const gamma = +(npd1 / (S * sigma * sqrtT)).toFixed(5);

  // Theta (annualized converted to per calendar day)
  const thetaAnnual =
    -(S * npd1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * nd2;
  const thetaDaily = +(thetaAnnual / 365).toFixed(2);

  // Vega (change per 1% move in IV)
  const vega1Pct = +((S * sqrtT * npd1) / 100).toFixed(2);

  const intrinsicValue = Math.max(0, +(S - K).toFixed(2));
  const timeValue = Math.max(0, +(callPrice - intrinsicValue).toFixed(2));

  return {
    theoreticalPrice: Math.max(0.05, +callPrice.toFixed(2)),
    delta,
    gamma,
    theta: thetaDaily,
    vega: vega1Pct,
    intrinsicValue,
    timeValue,
  };
}
