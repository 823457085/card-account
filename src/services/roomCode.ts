function hasConsecutive(arr: number[], len: number, diff: number): boolean {
  if (arr.length < len) return false;
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
    if (arr[i] === arr[i + 1] && arr[i] === arr[i + 2]) {
      return true;
    }
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

export function generateRoomId(): string {
  const existing = new Set<string>();
  let attempts = 0;
  while (attempts < 100) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    if (validateRoomId(id) && !existing.has(id)) {
      return id;
    }
    attempts++;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}
