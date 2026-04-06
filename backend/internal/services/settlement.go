package services

import (
	"card-account/internal/models"
	"sort"
)

// SettlementService handles settlement calculations
type SettlementService struct{}

// NewSettlementService creates a new settlement service
func NewSettlementService() *SettlementService {
	return &SettlementService{}
}

// CalculateRoundSettlement calculates the settled items for a single round
// Rules:
// - Winner 1 + Loser 1: loser pays winner `amount`
// - Winner 1 + Losers N: each loser pays winner `amount/N`
// - Winners N + Loser 1: loser pays each winner `amount/N`
// - Winners N + Losers M: each winner gets (amount * winner_count / loser_count) from each loser
func (s *SettlementService) CalculateRoundSettlement(winners, losers []string, amount float64) []models.SettlementItem {
	var items []models.SettlementItem

	winnerCount := len(winners)
	loserCount := len(losers)

	if winnerCount == 1 && loserCount == 1 {
		// Simple 1v1: loser pays winner full amount
		items = append(items, models.SettlementItem{
			From:   losers[0],
			To:     winners[0],
			Amount: amount,
		})
	} else if winnerCount == 1 && loserCount > 1 {
		// 1 winner vs N losers: each loser pays winner amount/loserCount
		share := amount / float64(loserCount)
		for _, loser := range losers {
			items = append(items, models.SettlementItem{
				From:   loser,
				To:     winners[0],
				Amount: share,
			})
		}
	} else if winnerCount > 1 && loserCount == 1 {
		// N winners vs 1 loser: loser pays each winner amount/winnerCount
		share := amount / float64(winnerCount)
		for _, winner := range winners {
			items = append(items, models.SettlementItem{
				From:   losers[0],
				To:     winner,
				Amount: share,
			})
		}
	} else {
		// N winners vs M losers: each loser pays each winner amount/(N*M)
		share := amount / float64(winnerCount*loserCount)
		for _, loser := range losers {
			for _, winner := range winners {
				items = append(items, models.SettlementItem{
					From:   loser,
					To:     winner,
					Amount: share,
				})
			}
		}
	}
	return items
}

// CalculateMinimumTransfers calculates the minimum transfer path for final settlement
// Algorithm: greedy matching of max creditor with max debtor
func (s *SettlementService) CalculateMinimumTransfers(players []models.Player, initialScore int) []models.SettlementItem {
	// Calculate net balance for each player
	// Net = currentScore - initialScore (positive = should receive, negative = should pay)
	type balance struct {
		playerID string
		name     string
		net      float64
	}

	var balances []balance
	for _, p := range players {
		balances = append(balances, balance{
			playerID: p.PlayerID,
			name:     p.Name,
			net:      float64(p.CurrentScore - initialScore),
		})
	}

	// Split into creditors (net > 0) and debtors (net < 0)
	var creditors, debtors []balance
	for _, b := range balances {
		if b.net > 0.01 { // creditor
			creditors = append(creditors, b)
		} else if b.net < -0.01 { // debtor
			debtors = append(debtors, b)
		}
	}

	// Sort by absolute net amount descending
	sort.Slice(creditors, func(i, j int) bool {
		return creditors[i].net > creditors[j].net
	})
	sort.Slice(debtors, func(i, j int) bool {
		return debtors[i].net < debtors[j].net
	})

	var transfers []models.SettlementItem

	// Greedy matching
	i, j := 0, 0
	for i < len(creditors) && j < len(debtors) {
		credit := creditors[i].net
		debt := -debtors[j].net

		amount := credit
		if debt < credit {
			amount = debt
		}

		if amount > 0.01 {
			transfers = append(transfers, models.SettlementItem{
				From:   debtors[j].playerID,
				To:     creditors[i].playerID,
				Amount: amount,
			})
		}

		creditors[i].net -= amount
		debtors[j].net += amount

		if creditors[i].net < 0.01 {
			i++
		}
		if debtors[j].net > -0.01 {
			j++
		}
	}

	return transfers
}
