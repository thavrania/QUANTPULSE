import { Position } from '../types/quant';

export type TslMilestone = 'PLUS_1R' | 'PLUS_2R' | 'EXIT';

export function advancePositionMilestone(position: Position, milestone: TslMilestone): Position {
  if (position.stateIndex === 4) return position;

  const r = position.riskPerUnit;
  const updated = { ...position };

  if (milestone === 'PLUS_1R') {
    updated.currentLtp = +(updated.entryPrice + r).toFixed(2);
    updated.activeTrailingSl = +(updated.entryPrice + r * 0.05).toFixed(2);
    updated.stateIndex = 2;
    updated.stateLabel = 'State 2: +1R Breakeven Lock';
  } else if (milestone === 'PLUS_2R') {
    updated.currentLtp = +(updated.entryPrice + r * 2).toFixed(2);
    updated.activeTrailingSl = +(updated.entryPrice + r).toFixed(2);
    updated.stateIndex = 3;
    updated.stateLabel = 'State 3: +2R Profit Trail';
  } else if (milestone === 'EXIT') {
    updated.stateIndex = 4;
    updated.stateLabel = 'State 4: Exited / Closed';
  }

  return updated;
}

export function autoUpdatePositionFromTick(pos: Position): Position {
  if (pos.stateIndex === 4) return pos;

  const delta = (Math.random() - 0.40) * pos.riskPerUnit * 0.35;
  const newLtp = Math.max(1, +(pos.currentLtp + delta).toFixed(2));
  const gain = newLtp - pos.entryPrice;

  const updated: Position = { ...pos, currentLtp: newLtp };

  if (gain >= pos.riskPerUnit * 2 && updated.stateIndex < 3) {
    updated.activeTrailingSl = +(updated.entryPrice + pos.riskPerUnit).toFixed(2);
    updated.stateIndex = 3;
    updated.stateLabel = 'State 3: +2R Profit Trail';
  } else if (gain >= pos.riskPerUnit && updated.stateIndex < 2) {
    updated.activeTrailingSl = updated.entryPrice;
    updated.stateIndex = 2;
    updated.stateLabel = 'State 2: +1R Breakeven Lock';
  }

  return updated;
}
