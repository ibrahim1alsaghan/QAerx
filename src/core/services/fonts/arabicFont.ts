/**
 * Arabic Font Support for jsPDF
 *
 * This module provides Arabic font support using Amiri font.
 * The font is loaded from a CDN and cached for subsequent use.
 */

import { jsPDF } from 'jspdf';

// Cache for loaded font data
let amiriFontData: string | null = null;
let amiriBoldFontData: string | null = null;
let fontLoadPromise: Promise<boolean> | null = null;

// Multiple CDN sources for reliability - try each in order
// jsPDF works best with TTF fonts

// Amiri font - excellent for Arabic text (TTF format required for jsPDF)
const AMIRI_CDN_SOURCES = [
  // jsDelivr - mirrors Google Fonts
  'https://cdn.jsdelivr.net/fontsource/fonts/amiri@latest/latin-400-normal.ttf',
  // Google Fonts static CDN - direct TTF
  'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHpUrtLMA7w.ttf',
  // Alternative Google Fonts URL format
  'https://fonts.gstatic.com/s/amiri/v24/J7aRnpd8CGxBHpUrtLMA7w.ttf',
];

const AMIRI_BOLD_CDN_SOURCES = [
  'https://cdn.jsdelivr.net/fontsource/fonts/amiri@latest/latin-700-normal.ttf',
  'https://fonts.gstatic.com/s/amiri/v27/J7acnpd8CGxBHp2VkaY6zp5yGw.ttf',
];

// Noto Sans Arabic as fallback (broader Unicode support)
const NOTO_ARABIC_CDN_SOURCES = [
  'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvu3CBFQLaig.ttf',
];

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Fetch font file and convert to base64
 */
async function fetchFontAsBase64(url: string): Promise<string | null> {
  try {
    console.log(`[ArabicFont] Fetching: ${url}`);

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    // Note: Chrome extensions with host_permissions don't need CORS mode
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': '*/*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[ArabicFont] HTTP ${response.status} from ${url}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    console.log(`[ArabicFont] Downloaded ${buffer.byteLength} bytes from ${url}`);

    // Lower threshold - some fonts might be smaller when served compressed
    if (buffer.byteLength < 1000) {
      console.warn(`[ArabicFont] Font file too small from ${url}: ${buffer.byteLength} bytes`);
      return null;
    }

    // Verify it's a valid TTF/OTF file (jsPDF only supports these, not WOFF)
    const bytes = new Uint8Array(buffer);
    const isTTF = bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00;
    const isOTF = bytes[0] === 0x4F && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4F;
    const isWOFF = bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && bytes[3] === 0x46;

    if (isWOFF) {
      console.warn(`[ArabicFont] WOFF format not supported by jsPDF, skipping: ${url}`);
      return null;
    }

    if (!isTTF && !isOTF) {
      console.warn(`[ArabicFont] Invalid font format from ${url}, magic bytes: ${bytes[0]?.toString(16)} ${bytes[1]?.toString(16)} ${bytes[2]?.toString(16)} ${bytes[3]?.toString(16)}`);
      return null;
    }

    console.log(`[ArabicFont] Valid ${isTTF ? 'TTF' : 'OTF'} font file detected`);

    const base64 = arrayBufferToBase64(buffer);
    console.log(`[ArabicFont] Successfully converted to base64, length: ${base64.length}`);
    return base64;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[ArabicFont] Timeout fetching font from ${url}`);
    } else {
      console.error('[ArabicFont] Error fetching font:', error);
    }
    return null;
  }
}

/**
 * Try to fetch font from multiple CDN sources
 */
async function fetchFontFromSources(sources: string[]): Promise<string | null> {
  for (const url of sources) {
    console.log(`[ArabicFont] Trying font source: ${url.substring(0, 50)}...`);
    const result = await fetchFontAsBase64(url);
    if (result) {
      console.log(`[ArabicFont] Successfully loaded from: ${url.substring(0, 50)}...`);
      return result;
    }
  }
  return null;
}

/**
 * Load Arabic fonts (Amiri or Noto Sans Arabic fallback) for jsPDF
 * Returns true if fonts were loaded successfully
 */
export async function loadArabicFonts(): Promise<boolean> {
  // Return cached result if already loading
  if (fontLoadPromise) {
    return fontLoadPromise;
  }

  // Start loading
  fontLoadPromise = (async () => {
    console.log('[ArabicFont] Loading Arabic fonts from multiple CDN sources...');

    // Try loading Amiri font from multiple sources
    amiriFontData = await fetchFontFromSources(AMIRI_CDN_SOURCES);

    // If Amiri fails, try Noto Sans Arabic as fallback
    if (!amiriFontData) {
      console.log('[ArabicFont] Amiri failed, trying Noto Sans Arabic...');
      amiriFontData = await fetchFontFromSources(NOTO_ARABIC_CDN_SOURCES);

      if (amiriFontData) {
        console.log('[ArabicFont] Using Noto Sans Arabic as fallback');
      }
    } else {
      // Also try to load bold variant if regular succeeded
      amiriBoldFontData = await fetchFontFromSources(AMIRI_BOLD_CDN_SOURCES);
    }

    if (amiriFontData) {
      console.log('[ArabicFont] Arabic fonts loaded successfully');
      return true;
    } else {
      console.warn('[ArabicFont] Failed to load Arabic fonts from all sources, Arabic text may not render correctly');
      return false;
    }
  })();

  return fontLoadPromise;
}

/**
 * Register Arabic fonts with a jsPDF instance
 */
export function registerArabicFonts(doc: jsPDF): boolean {
  if (!amiriFontData) {
    console.warn('[ArabicFont] Arabic fonts not loaded, call loadArabicFonts() first');
    return false;
  }

  try {
    // Add regular font
    doc.addFileToVFS('Amiri-Regular.ttf', amiriFontData);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

    // Add bold font if available
    if (amiriBoldFontData) {
      doc.addFileToVFS('Amiri-Bold.ttf', amiriBoldFontData);
      doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold');
    }

    return true;
  } catch (error) {
    console.error('[ArabicFont] Error registering fonts:', error);
    return false;
  }
}

/**
 * Check if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  if (!text) return false;
  // Arabic Unicode range: U+0600 to U+06FF (Arabic)
  // Also includes U+0750 to U+077F (Arabic Supplement)
  // And U+08A0 to U+08FF (Arabic Extended-A)
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

/**
 * Check if text contains any RTL characters (Arabic, Hebrew, etc.)
 */
export function containsRTL(text: string): boolean {
  if (!text) return false;
  // RTL characters: Arabic, Hebrew, Syriac, Thaana, etc.
  return /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Prepare Arabic text for jsPDF rendering
 * Modern jsPDF with proper font support handles RTL automatically
 * We just need to ensure the text is properly encoded
 */
export function prepareArabicText(text: string): string {
  if (!text || !containsArabic(text)) return text;

  // With proper Arabic font loaded, jsPDF should handle the text correctly
  // We don't need to reverse the text - the font handles RTL rendering

  // Just ensure we have clean Unicode text
  // Remove any zero-width characters that might cause issues
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .normalize('NFC'); // Normalize Unicode form
}

/**
 * Alternative: Reverse text for older jsPDF versions that don't handle RTL
 * Use this if prepareArabicText doesn't work correctly
 */
export function reverseArabicText(text: string): string {
  if (!text || !containsArabic(text)) return text;

  // Split into Arabic and non-Arabic segments
  const segments: { text: string; isArabic: boolean }[] = [];
  let currentSegment = '';
  let currentIsArabic: boolean | null = null;

  for (const char of text) {
    const charIsArabic = containsArabic(char);

    if (currentIsArabic === null) {
      currentIsArabic = charIsArabic;
      currentSegment = char;
    } else if (charIsArabic === currentIsArabic) {
      currentSegment += char;
    } else {
      segments.push({ text: currentSegment, isArabic: currentIsArabic });
      currentSegment = char;
      currentIsArabic = charIsArabic;
    }
  }

  if (currentSegment) {
    segments.push({ text: currentSegment, isArabic: currentIsArabic! });
  }

  // Process segments - reverse only Arabic portions
  const processedSegments = segments.map(segment => {
    if (segment.isArabic) {
      // Use proper Unicode bidi algorithm awareness
      return [...segment.text].reverse().join('');
    }
    return segment.text;
  });

  // Reverse segment order for primarily Arabic text
  const arabicCharCount = text.replace(/[^\u0600-\u06FF]/g, '').length;
  const isMainlyArabic = arabicCharCount > text.length / 2;

  if (isMainlyArabic) {
    return processedSegments.reverse().join('');
  }

  return processedSegments.join('');
}

/**
 * Get the appropriate font name based on text content
 */
export function getFontForText(text: string, hasArabicFont: boolean): string {
  if (hasArabicFont && containsArabic(text)) {
    return 'Amiri';
  }
  return 'helvetica';
}

/**
 * Pre-load fonts at app startup for faster PDF generation
 */
export function preloadFonts(): void {
  loadArabicFonts().catch(err => {
    console.warn('[ArabicFont] Background font preload failed:', err);
  });
}
