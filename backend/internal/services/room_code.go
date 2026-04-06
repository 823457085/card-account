package services

import (
	"crypto/rand"
	"math/big"
	"strings"
)

var usedRoomCodes = make(map[string]bool)

// IsValidRoomCode checks if a room code is valid
func IsValidRoomCode(code string) bool {
	if len(code) != 6 {
		return false
	}
	// No leading zero
	if code[0] == '0' {
		return false
	}
	// No 3 consecutive ascending or descending
	for i := 0; i < 4; i++ {
		d0 := int(code[i] - '0')
		d1 := int(code[i+1] - '0')
		d2 := int(code[i+2] - '0')
		if d1 == d0+1 && d2 == d1+1 {
			return false
		}
		if d1 == d0-1 && d2 == d1-1 {
			return false
		}
	}
	// No 3 repeated digits
	for i := 0; i < 4; i++ {
		if code[i] == code[i+1] && code[i+1] == code[i+2] {
			return false
		}
	}
	return true
}

// GenerateRoomCode generates a unique 6-digit room code
func GenerateRoomCode() (string, error) {
	for i := 0; i < 100; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(900000))
		if err != nil {
			return "", err
		}
		code := string(rune(n.Int64() + 100000)) // 100000-999999, never starts with 0
		if usedRoomCodes[code] {
			continue
		}
		if IsValidRoomCode(code) {
			usedRoomCodes[code] = true
			return code, nil
		}
	}
	// Fallback: generate and validate
	for {
		n, err := rand.Int(rand.Reader, big.NewInt(900000))
		if err != nil {
			return "", err
		}
		code := string(rune(n.Int64() + 100000))
		if IsValidRoomCode(code) && !usedRoomCodes[code] {
			usedRoomCodes[code] = true
			return code, nil
		}
	}
}

// ReleaseRoomCode marks a room code as available again
func ReleaseRoomCode(code string) {
	delete(usedRoomCodes, code)
}

// LoadExistingCodes loads existing room codes from DB to avoid collisions
func LoadExistingCodes(codes []string) {
	for _, c := range codes {
		usedRoomCodes[c] = true
	}
}

// AvatarColors returns a list of available avatar colors
var AvatarColors = []string{
	"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
	"#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
	"#BB8FCE", "#85C1E9",
}

// GetAvatarColor returns a color based on index
func GetAvatarColor(index int) string {
	return AvatarColors[index%len(AvatarColors)]
}

// DefaultAvatarColors returns default color for a name
func DefaultAvatarColor(name string) string {
	sum := 0
	for _, c := range strings.ToLower(name) {
		sum += int(c)
	}
	return AvatarColors[sum%len(AvatarColors)]
}
