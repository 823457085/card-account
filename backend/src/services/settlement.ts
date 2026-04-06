import { Player, SettlementItem } from '../models/types.js';

export function calculateSettlements(players: Player[], initialScore: number): SettlementItem[] {
  const balances = players.map(p => ({
    playerId: p.playerId,
    balance: p.currentScore - initialScore
  }));

  const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);

  const settlements: SettlementItem[] = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debit = debtors[j];
    const amount = Math.min(credit.balance, Math.abs(debit.balance));

    if (amount > 0) {
      settlements.push({ from: debit.playerId, to: credit.playerId, amount: Math.round(amount) });
    }

    credit.balance -= amount;
    debit.balance += amount;

    if (credit.balance <= 0.5) i++;
    if (debit.balance >= -0.5) j++;
  }

  return settlements;
}
