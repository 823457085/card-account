// Room code validation and generation
// Rules:
// 1. 6 digits, no leading zero
// 2. No 3 consecutive ascending/descending digits (e.g. 123, 321)
// 3. No 3 repeating digits (e.g. 111, 000)

function hasConsecutive(arr: number[], len: number, diff: number): boolean {
  for (let i = 0; i <= arr.length - len; i++) {
    let ok = true;
    for (let j = 0; j < len - 1; j++) {
      if (arr[i + j + 1] - arr[i + j] !== diff) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function hasRepeating(arr: number[], len: number): boolean {
  for (let i = 0; i <= arr.length - len; i++) {
    if (arr[i] === arr[i + 1] && arr[i] === arr[i + 2]) return true;
  }
  return false;
}

export function validateRoomId(roomId: string): boolean {
  if (!/^\d{6}$/.test(roomId)) return false;
  if (roomId.startsWith('0')) return false;
  const digits = roomId.split('').map(Number);
  if (hasRepeating(digits, 3)) return false;
  if (hasConsecutive(digits, 3, 1)) return false;
  if (hasConsecutive(digits, 3, -1)) return false;
  return true;
}

export function generateRoomId(existingCodes: Set<string>): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const id = String(100000 + Math.floor(Math.random() * 900000));
    if (validateRoomId(id) && !existingCodes.has(id)) {
      return id;
    }
  }
  // Fallback: just generate and hope
  return String(100000 + Math.floor(Math.random() * 900000));
}
