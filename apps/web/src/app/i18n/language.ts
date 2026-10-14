export const LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'can-i-run-it.language';

/** The language picked earlier, else the browser's if supported, else English. */
export function initialLanguage(): Language {
  const saved = readStorage(STORAGE_KEY);
  if (isLanguage(saved)) return saved;
  const browser = typeof navigator === 'undefined' ? undefined : navigator.language?.slice(0, 2);
  return isLanguage(browser) ? browser : 'en';
}

export function rememberLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable (private mode): the choice lasts for this visit only.
  }
}

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
