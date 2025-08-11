import { OutreachMember } from '../types';

export interface ParsedOutreachData {
  name: string;
  phoneNumber?: string;
  roomNumber?: string;
  rawText: string;
  confidence: number;
  issues: string[];
}

export interface OutreachParseResult {
  contacts: ParsedOutreachData[];
  totalLines: number;
  successfullyParsed: number;
  errors: string[];
}

/**
 * Smart text parser for Outreach bulk add
 * Learns/detects: phone number, full name, and room number
 * Supports lines ordered as:
 *  - Room – Name – Phone
 *  - Name – Room – Phone
 *  - Phone – Name – Room
 * Also handles basic separators: -, –, —, |, , and whitespace
 */
export class OutreachTextParser {
  // Reuse robust phone patterns (South Africa-centric, but permissive)
  private static readonly PHONE_PATTERNS = [
    /(\+27\s?\d{2}\s?\d{3}\s?\d{4})/g,
    /(\+27\s?\d{9})/g,
    /(0\d{2}\s?\d{3}\s?\d{4})/g,
    /(\d{10})/g,
    /(\d{9})/g,
    /(\(\d{3}\)\s?\d{3}[-\s]?\d{4})/g,
    /(\d{3}[-\s]?\d{3}[-\s]?\d{4})/g,
    // Fallback: any sequence with 9-13 digits allowing separators
    /(\+?\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d[\s\-().]*\d(?:[\s\-().]*\d){0,4})/g,
  ];

  // Label words to ignore when extracting names/rooms
  private static readonly LABEL_WORDS = new Set([
    'room','rm','apt','apartment','flat','unit','block','blk','bldg','building','no','number','num',
    'phone','tel','cell','mobile','name','contact','contacts'
  ]);

  // Basic name heuristic: first two capitalized words are treated as a name
  private static looksLikeName(word: string): boolean {
    return /^[A-Z][a-zA-Z'\-]*$/.test(word) && word.length >= 2;
  }

  static parseText(text: string): OutreachParseResult {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const contacts: ParsedOutreachData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const parsed = this.parseLine(lines[i]);
        if (parsed) contacts.push(parsed);
      } catch (e: any) {
        errors.push(`Line ${i + 1}: ${e?.message || 'Unknown error'}`);
      }
    }

    return {
      contacts,
      totalLines: lines.length,
      successfullyParsed: contacts.length,
      errors
    };
  }

  private static parseLine(line: string): ParsedOutreachData | null {
    if (!line || line.length < 2) return null;

    const rawText = line;
    let cleaned = this.cleanLine(line);

    const issues: string[] = [];

    // 1) Phone
    const phoneMatches = this.extractPhoneNumbers(cleaned);
    let phone: string | undefined = undefined;
    if (phoneMatches.length > 0) {
      phone = this.normalizePhoneNumber(phoneMatches[0]);
      cleaned = cleaned.replace(phoneMatches[0], '').trim();
    }

    // 2) Room number
    const room = this.extractRoomNumber(cleaned, phoneMatches);
    if (room) {
      cleaned = cleaned.replace(room, '').trim();
    }

    // Remove possible keywords around room
    cleaned = cleaned.replace(/\b(room|rm|apt|flat|unit)\b\s*[:#\-]?\s*/i, '').trim();

    // 3) Name – attempt to use the beginning words as name
    const name = this.extractName(cleaned);
    if (!name) {
      issues.push('No name detected');
    }

    const result: ParsedOutreachData = {
      name: name || '',
      phoneNumber: phone,
      roomNumber: room,
      rawText,
      confidence: this.calculateConfidence(!!name, !!phone, !!room),
      issues
    };

    if (!result.phoneNumber) issues.push('No phone number detected');
    if (!result.roomNumber) issues.push('No room number detected');

    return name ? result : null;
  }

  private static cleanLine(line: string): string {
    let cleaned = line
      .replace(/^\s*\d+\.\s*/, '') // leading numbering "1. "
      .replace(/^\s*[-•*]\s*/, '') // bullets
      .replace(/^\s*\(\d+\)\s*/, '') // (1)
      .replace(/^\s*\[\d+\]\s*/, '') // [1]
      .replace(/[–—]/g, '-') // normalize dashes
  .replace(/[“”"'`]+/g, '') // quotes
  .replace(/[•·•·]/g, ' ') // bullets/points
  .replace(/[|_|~*]+/g, ' - ') // map odd separators to dashes
  .replace(/\s*-[\s-]*/g, ' - ') // normalize dashes spacing
  .replace(/[,;:]+/g, ' - ') // unify separators
  .replace(/\s+/g, ' ') // collapse spaces
      .trim();
    return cleaned;
  }

  private static extractPhoneNumbers(text: string): string[] {
    const nums: string[] = [];
    for (const p of this.PHONE_PATTERNS) {
      const m = text.match(p);
      if (m) nums.push(...m);
    }
    return nums;
  }

  private static normalizePhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+27')) return cleaned;
    if (cleaned.startsWith('27') && cleaned.length === 11) return '+' + cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 10) return '+27' + cleaned.substring(1);
    if (cleaned.length === 9) return '+27' + cleaned;
    return phone;
  }

  /**
   * Extract room number:
   *  - Explicit forms: "Room 814", "Rm 814", "Unit A12", "Flat 805" => capture token after keyword
   *  - Standalone tokens that look like room: 2-4 digits or letter+digits (e.g., 814, 12B, B12)
   * Excludes long numbers that are likely phones.
   */
  private static extractRoomNumber(text: string, phoneMatches: string[]): string | undefined {
    const phoneFragments = phoneMatches.join(' ');

    // 1) Keyword-based
    const keywordMatch = text.match(/\b(room|rm|apt|apartment|flat|unit|block|blk|bldg|building|no|number|#)\b\s*[:.#\-]?\s*([A-Za-z]?\d{1,4}[A-Za-z]?)/i);
    if (keywordMatch) return keywordMatch[2];

    // 2) Standalone plausible room tokens (2-4 chars with digits, exclude parts of phone)
    const candidates = text.match(/\b(#?[A-Za-z]?\d{1,4}[A-Za-z]?)\b/g) || [];
    for (const c of candidates) {
      // Skip if numeric length >= 7 (likely phone) or appears inside a phone fragment
      const digits = c.replace(/\D/g, '');
      if (digits.length >= 7) continue;
      if (phoneFragments.includes(c)) continue;
      // Prefer tokens that are mostly digits (room numbers are typically numeric)
      if (digits.length >= 1 && digits.length <= 4) return c.replace(/^#/, '');
    }
    return undefined;
  }

  private static extractName(text: string): string | undefined {
    // Split by common separators and pick the first non-empty segment
    const segments = text.split(/[|,;:\-]/).map(s => s.trim()).filter(Boolean);
    const candidate = segments[0] || text.trim();
    // Remove label words and numeric tokens
    const words = candidate
      .split(/\s+/)
      .filter(Boolean)
      .filter(w => !this.LABEL_WORDS.has(w.toLowerCase()))
      .filter(w => !/\d/.test(w));

    if (words.length >= 2 && this.looksLikeName(words[0]) && this.looksLikeName(words[1])) {
      return `${words[0]} ${words[1]}`;
    }
    if (words.length >= 1 && this.looksLikeName(words[0])) {
      // Single name fallback
      return words[0];
    }
    // Fallback: scan whole text for two consecutive name-like words
    const all = text
      .split(/\s+/)
      .filter(Boolean)
      .filter(w => !this.LABEL_WORDS.has(w.toLowerCase()))
      .filter(w => !/\d/.test(w));
    for (let i = 0; i < all.length - 1; i++) {
      if (this.looksLikeName(all[i]) && this.looksLikeName(all[i + 1])) {
        return `${all[i]} ${all[i + 1]}`;
      }
    }
    return undefined;
  }

  private static calculateConfidence(hasName: boolean, hasPhone: boolean, hasRoom: boolean): number {
    let score = 0;
    if (hasName) score += 0.5;
    if (hasPhone) score += 0.3;
    if (hasRoom) score += 0.2;
    return Math.min(1, score);
  }

  static convertToOutreachMember(
    parsed: ParsedOutreachData,
    bacentaId: string,
    outreachDate: string
  ): Omit<OutreachMember, 'id' | 'createdDate' | 'lastUpdated'> {
    return {
      name: parsed.name || 'Unknown',
      phoneNumbers: parsed.phoneNumber ? [parsed.phoneNumber] : [],
      roomNumber: parsed.roomNumber,
      bacentaId,
      comingStatus: false,
      outreachDate,
    } as any; // remaining optional props will be added by handler
  }
}

export default OutreachTextParser;
