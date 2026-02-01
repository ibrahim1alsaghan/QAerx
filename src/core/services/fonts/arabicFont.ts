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
// Using jsDelivr (npm-based CDN) and unpkg as they have stable URLs

// Amiri font - excellent for Arabic text
const AMIRI_CDN_SOURCES = [
  // jsDelivr - stable npm-based CDN
  'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.19/files/amiri-arabic-400-normal.woff',
  // Alternative: raw GitHub from a font repository
  'https://raw.githubusercontent.com/AbiSourceCode/AbiSourceData/main/fonts/amiri/Amiri-Regular.ttf',
];

const AMIRI_BOLD_CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5.0.19/files/amiri-arabic-700-normal.woff',
  'https://raw.githubusercontent.com/AbiSourceCode/AbiSourceData/main/fonts/amiri/Amiri-Bold.ttf',
];

// Noto Sans Arabic as fallback (broader Unicode support)
const NOTO_ARABIC_CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.0.19/files/noto-sans-arabic-arabic-400-normal.woff',
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
    const response = await fetch(url, {
      // Add timeout and headers for better compatibility
      headers: {
        'Accept': 'font/woff, font/woff2, font/ttf, application/font-woff, application/font-woff2, */*',
      },
    });
    if (!response.ok) {
      console.warn(`[ArabicFont] Failed to fetch font from ${url}: ${response.status}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 1000) {
      // Font file too small, likely an error page
      console.warn(`[ArabicFont] Font file suspiciously small from ${url}: ${buffer.byteLength} bytes`);
      return null;
    }
    return arrayBufferToBase64(buffer);
  } catch (error) {
    console.error('[ArabicFont] Error fetching font:', error);
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
