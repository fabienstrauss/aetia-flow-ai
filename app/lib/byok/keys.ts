const KEYS = {
  gemini: 'byok:gemini',
  tavily: 'byok:tavily',
  hera: 'byok:hera',
} as const;

export type ByokProvider = keyof typeof KEYS;

export function getStoredKey(provider: ByokProvider): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEYS[provider]) ?? '';
}

export function setStoredKey(provider: ByokProvider, key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem(KEYS[provider], key.trim());
  } else {
    localStorage.removeItem(KEYS[provider]);
  }
}

export function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  (Object.keys(KEYS) as ByokProvider[]).forEach((provider) => {
    const key = getStoredKey(provider);
    if (key) headers[`x-${provider}-key`] = key;
  });
  return headers;
}
