// Romaji to Hiragana/Katakana converter

const ROMAJI_TO_HIRAGANA: Record<string, string> = {
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  'sa': 'さ', 'si': 'し', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  'ta': 'た', 'ti': 'ち', 'chi': 'ち', 'tu': 'つ', 'tsu': 'つ', 'te': 'て', 'to': 'と',
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  'ha': 'は', 'hi': 'ひ', 'hu': 'ふ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  'wa': 'わ', 'wi': 'ゐ', 'we': 'ゑ', 'wo': 'を',
  'n': 'ん', 'nn': 'ん',
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  'za': 'ざ', 'zi': 'じ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'sya': 'しゃ', 'syu': 'しゅ', 'syo': 'しょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'tya': 'ちゃ', 'tyu': 'ちゅ', 'tyo': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
  'jya': 'じゃ', 'jyu': 'じゅ', 'jyo': 'じょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  '-': 'ー',
};

// Hiragana to Katakana offset
const HIRAGANA_START = 0x3041;
const KATAKANA_START = 0x30A1;
const KANA_RANGE = 0x0060;

function hiraganaToKatakana(hiragana: string): string {
  let result = '';
  for (const char of hiragana) {
    const code = char.charCodeAt(0);
    if (code >= HIRAGANA_START && code < HIRAGANA_START + KANA_RANGE) {
      result += String.fromCharCode(code + (KATAKANA_START - HIRAGANA_START));
    } else {
      result += char;
    }
  }
  return result;
}

export function romajiToHiragana(input: string): string {
  let result = '';
  let i = 0;
  const str = input.toLowerCase();

  while (i < str.length) {
    // Check for double consonant (っ)
    if (i + 1 < str.length && str[i] === str[i + 1] && 'bcdfghjklmpqrstvwxyz'.includes(str[i])) {
      result += 'っ';
      i++;
      continue;
    }

    // Try longest match first (4, 3, 2, 1 chars)
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      const chunk = str.substring(i, i + len);
      if (ROMAJI_TO_HIRAGANA[chunk]) {
        // Special case: 'n' before a vowel or 'y' should not be ん
        if (chunk === 'n' && i + 1 < str.length) {
          const next = str[i + 1];
          if ('aiueoy'.includes(next)) {
            continue; // Skip single 'n', try 'na', 'ni' etc.
          }
        }
        result += ROMAJI_TO_HIRAGANA[chunk];
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += str[i]; // Pass through unknown chars
      i++;
    }
  }

  return result;
}

export function romajiToKatakana(input: string): string {
  return hiraganaToKatakana(romajiToHiragana(input));
}

export function isHiragana(str: string): boolean {
  return /^[\u3040-\u309F\u30FC\-]+$/.test(str);
}

export function isKatakana(str: string): boolean {
  return /^[\u30A0-\u30FF\u30FC\-]+$/.test(str);
}

export function isKana(str: string): boolean {
  return /^[\u3040-\u30FF\u30FC\-]+$/.test(str);
}

// Normalize input: if already kana, return as-is; otherwise convert romaji
export function normalizeReading(input: string, toKatakana = false): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (isKana(trimmed)) return trimmed;

  return toKatakana ? romajiToKatakana(trimmed) : romajiToHiragana(trimmed);
}
