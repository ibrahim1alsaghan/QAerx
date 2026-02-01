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
let fontLoadPromise: Promise<void> | null = null;

// Amiri font from CDN (Arabic-optimized, supports RTL)
// Using a reliable CDN that hosts Arabic fonts
const AMIRI_REGULAR_URL = 'https://cdn.jsdelivr.net/gh/AhmadHussein1/Amiri-fonts@1.0/Amiri-Regular.ttf';
const AMIRI_BOLD_URL = 'https://cdn.jsdelivr.net/gh/AhmadHussein1/Amiri-fonts@1.0/Amiri-Bold.ttf';

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
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[ArabicFont] Failed to fetch font from ${url}: ${response.status}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    return arrayBufferToBase64(buffer);
  } catch (error) {
    console.error('[ArabicFont] Error fetching font:', error);
    return null;
  }
}

/**
 * Load Arabic fonts (Amiri) for jsPDF
 * Returns true if fonts were loaded successfully
 */
export async function loadArabicFonts(): Promise<boolean> {
  // Return cached result if already loading
  if (fontLoadPromise) {
    await fontLoadPromise;
    return amiriFontData !== null;
  }

  // Start loading
  fontLoadPromise = (async () => {
    console.log('[ArabicFont] Loading Arabic fonts...');

    // Load regular font
    amiriFontData = await fetchFontAsBase64(AMIRI_REGULAR_URL);

    // Load bold font
    amiriBoldFontData = await fetchFontAsBase64(AMIRI_BOLD_URL);

    if (amiriFontData) {
      console.log('[ArabicFont] Arabic fonts loaded successfully');
    } else {
      console.warn('[ArabicFont] Failed to load Arabic fonts, will use fallback');
    }
  })();

  await fontLoadPromise;
  return amiriFontData !== null;
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
 * Reverse Arabic text for proper RTL display in jsPDF
 * jsPDF doesn't handle RTL natively, so we need to reverse the text
 */
export function prepareArabicText(text: string): string {
  if (!text || !containsArabic(text)) return text;

  // Split text into segments: Arabic and non-Arabic
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

  // Reverse Arabic segments for RTL display
  // jsPDF renders text left-to-right, so we reverse Arabic portions
  const processedSegments = segments.map(segment => {
    if (segment.isArabic) {
      // Reverse the Arabic text
      return [...segment.text].reverse().join('');
    }
    return segment.text;
  });

  // If the text is primarily Arabic, reverse the segment order too
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
