import type { Player, SettlementItem } from '../types.js';

/**
 * Calculate score delta for a single round.
 * Winners receive positive delta, losers receive negative delta.
 */
export function calculateRoundScoreDelta(
  players: Player[],
  winners: string[],
  losers: string[],
  amount: number,
): Map<string, number> {
  const deltaMap = new Map<string, number>();
  players.forEach((p) => deltaMap.set(p.playerId, 0));

  const winnerCount = winners.length;
  const loserCount = losers.length;

  if (winnerCount === 1 && loserCount === 1) {
    // 1v1: loser pays winner full amount
    deltaMap.set(winners[0], amount);
    deltaMap.set(losers[0], -amount);
  } else if (winnerCount === 1 && loserCount > 1) {
    // 1 vs many: losers split the amount, winner gets all
    const perLoser = amount / loserCount;
    winners.forEach((w) => deltaMap.set(w, amount));
    losers.forEach((l) => deltaMap.set(l, -perLoser));
  } else if (winnerCount > 1 && loserCount === 1) {
    // many vs 1: loser pays winners equally
    const perWinner = amount / winnerCount;
    winners.forEach((w) => deltaMap.set(w, perWinner));
    losers.forEach((l) => deltaMap.set(l, -amount));
  } else {
    // many vs many: proportional split
    const totalPlayers = winnerCount + loserCount;
    winners.forEach((w) => deltaMap.set(w, (amount * loserCount) / totalPlayers));
    losers.forEach((l) => deltaMap.set(l, (-amount * winnerCount) / totalPlayers));
  }

  return deltaMap;
}

/**
 * Calculate minimum transfer paths for final settlement.
 * Uses a greedy algorithm: match largest creditor with largest debtor.
 */
export function calculateMinTransfers(
  players: Player[],
  initialScore: number,
): SettlementItem[] {
  const balances = players.map((p) => ({
    playerId: p.playerId,
    balance: p.currentScore - initialScore,
  }));

  const receivables = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);
  const payables = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance);

  const transfers: SettlementItem[] = [];

  let i = 0;
  let j = 0;

  while (i < receivables.length && j < payables.length) {
    const receivable = receivables[i];
    const payable = payables[j];

    const transferAmount = Math.min(receivable.balance, Math.abs(payable.balance));

    if (transferAmount > 0) {
      transfers.push({
        from: payable.playerId,
        to: receivable.playerId,
        amount: transferAmount,
      });
    }

    receivable.balance -= transferAmount;
    payable.balance += transferAmount;

    if (Math.abs(receivable.balance) < 0.001) i++;
    if (Math.abs(payable.balance) < 0.001) j++;
  }

  return transfers;
}
