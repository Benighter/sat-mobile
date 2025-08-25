import { Member } from '../types';

export interface ParsedMemberData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  buildingAddress: string;
  rawText: string; // Original text for reference
  confidence: number; // 0-1 score indicating parsing confidence
  issues: string[]; // Array of potential issues or warnings
}

export interface ParseResult {
  members: ParsedMemberData[];
  totalLines: number;
  successfullyParsed: number;
  errors: string[];
}

/**
 * Smart text parser that extracts member information from pasted text
 * Supports various formats and intelligently detects names, phone numbers, and addresses
 */
export class SmartTextParser {
  
  // Phone number patterns for different formats
  private static readonly PHONE_PATTERNS = [
    /(\+27\s?\d{2}\s?\d{3}\s?\d{4})/g, // +27 82 123 4567
    /(\+27\s?\d{9})/g, // +27821234567
    /(\+27\s?\d{2}\s?\d{3}\s?\d{4})/g, // +27 81 872 6246
    /(0\d{2}\s?\d{3}\s?\d{4})/g, // 082 123 4567 or 0821234567
    /(\d{10})/g, // 0821234567 (10 digits)
    /(\d{9})/g, // 821234567 (9 digits)
    /(\(\d{3}\)\s?\d{3}[-\s]?\d{4})/g, // (082) 123-4567
    /(\d{3}[-\s]?\d{3}[-\s]?\d{4})/g, // 082-123-4567 or 082 123 4567
  ];

  // Name patterns - typically first and last name separated by space
  private static readonly NAME_PATTERN = /^([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)$/;

  // Email pattern for potential contact info
  private static readonly EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  /**
   * Parse pasted text and extract member information
   */
  static parseText(text: string): ParseResult {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const members: ParsedMemberData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        const parsed = this.parseLine(line, i + 1);
        if (parsed) {
          members.push(parsed);
        }
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      members,
      totalLines: lines.length,
      successfullyParsed: members.length,
      errors
    };
  }

  /**
   * Parse a single line of text to extract member information
   */
  private static parseLine(line: string, _lineNumber: number): ParsedMemberData | null {
    if (!line || line.length < 3) {
      return null; // Skip very short lines
    }

    // Clean the line by removing irrelevant symbols and numbers at the beginning
    let cleanedLine = this.cleanLine(line);

    if (!cleanedLine || cleanedLine.length < 2) {
      return null; // Skip if nothing meaningful remains
    }

    const result: ParsedMemberData = {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      buildingAddress: '',
      rawText: line,
      confidence: 0,
      issues: []
    };

    // Extract phone numbers first
    const phoneNumbers = this.extractPhoneNumbers(cleanedLine);
    if (phoneNumbers.length > 0) {
      result.phoneNumber = this.normalizePhoneNumber(phoneNumbers[0]);
      // Remove phone number from line for further processing
      cleanedLine = cleanedLine.replace(phoneNumbers[0], '').trim();
    }

    // Extract email if present
    const emails = cleanedLine.match(this.EMAIL_PATTERN);
    if (emails && emails.length > 0) {
      // For now, we don't have an email field, but we could add it to address or notes
      cleanedLine = cleanedLine.replace(emails[0], '').trim();
    }

    // Try to extract names
    const nameMatch = this.extractNames(cleanedLine);
    if (nameMatch) {
      result.firstName = nameMatch.firstName;
      result.lastName = nameMatch.lastName;
      // Remove names from line for address extraction
      cleanedLine = cleanedLine.replace(nameMatch.fullMatch, '').trim();
    }

    // For bulk member addition, we don't want to auto-populate address from remaining text
    // as per user preference to keep it clean and minimal
    // Remaining text could be address, but we'll skip it for bulk additions
    // if (cleanedLine.length > 0) {
    //   result.buildingAddress = cleanedLine;
    // }

    // Calculate confidence score
    result.confidence = this.calculateConfidence(result);

    // Add issues/warnings
    this.addIssues(result);

    // Only return if we have at least a name
    if (result.firstName || result.lastName) {
      return result;
    }

    return null;
  }

  /**
   * Clean a line by removing irrelevant symbols, numbers, and formatting
   * Handles numbered lists and various separators
   */
  private static cleanLine(line: string): string {
    // Remove leading numbers and dots (e.g., "1.", "2.", "10.")
    let cleaned = line.replace(/^\s*\d+\.\s*/, '');

    // Remove other common list markers and symbols at the beginning
    cleaned = cleaned.replace(/^\s*[-•*]\s*/, ''); // bullets
    cleaned = cleaned.replace(/^\s*\(\d+\)\s*/, ''); // (1), (2), etc.
    cleaned = cleaned.replace(/^\s*\[\d+\]\s*/, ''); // [1], [2], etc.

    // Remove extra whitespace and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Extract phone numbers from text
   */
  private static extractPhoneNumbers(text: string): string[] {
    const numbers: string[] = [];
    
    for (const pattern of this.PHONE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        numbers.push(...matches);
      }
    }

    return numbers;
  }

  /**
   * Extract names from text
   */
  private static extractNames(text: string): { firstName: string; lastName: string; fullMatch: string } | null {
    // Clean text by removing common separators and symbols
    let cleanText = text;

    // Remove dashes that separate names from phone numbers (e.g., "John Smith - +27...")
    cleanText = cleanText.replace(/\s*-\s*\+?\d.*$/, '').trim();

    // Remove other common separators
    cleanText = cleanText.replace(/[|,;:].*$/, '').trim();

    // Try different approaches to extract names

    // Approach 1: Simple two-word pattern
    const simpleMatch = cleanText.match(this.NAME_PATTERN);
    if (simpleMatch) {
      return {
        firstName: simpleMatch[1].trim(),
        lastName: simpleMatch[2].trim(),
        fullMatch: simpleMatch[0]
      };
    }

    // Approach 2: First two words if they look like names
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    if (words.length >= 2) {
      const firstWord = words[0];
      const secondWord = words[1];

      // Check if they look like names (start with capital letter, contain only letters)
      if (this.looksLikeName(firstWord) && this.looksLikeName(secondWord)) {
        return {
          firstName: firstWord,
          lastName: secondWord,
          fullMatch: `${firstWord} ${secondWord}`
        };
      }
    }

    // Approach 3: Single word as first name
    if (words.length === 1 && this.looksLikeName(words[0])) {
      return {
        firstName: words[0],
        lastName: '',
        fullMatch: words[0]
      };
    }

    // Approach 4: Handle cases where names might be at the beginning before any separator
    const beforeSeparator = cleanText.split(/[-|,;:]/)[0].trim();
    if (beforeSeparator && beforeSeparator !== cleanText) {
      const separatorWords = beforeSeparator.split(/\s+/).filter(word => word.length > 0);
      if (separatorWords.length >= 2 && this.looksLikeName(separatorWords[0]) && this.looksLikeName(separatorWords[1])) {
        return {
          firstName: separatorWords[0],
          lastName: separatorWords[1],
          fullMatch: `${separatorWords[0]} ${separatorWords[1]}`
        };
      } else if (separatorWords.length === 1 && this.looksLikeName(separatorWords[0])) {
        return {
          firstName: separatorWords[0],
          lastName: '',
          fullMatch: separatorWords[0]
        };
      }
    }

    return null;
  }

  /**
   * Check if a word looks like a name
   */
  private static looksLikeName(word: string): boolean {
    // Must start with capital letter and contain only letters (and possibly apostrophes, hyphens)
    return /^[A-Z][a-zA-Z'-]*$/.test(word) && word.length >= 2;
  }

  /**
   * Normalize phone number to a consistent format
   */
  private static normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Handle South African numbers
    if (cleaned.startsWith('+27')) {
      return cleaned;
    } else if (cleaned.startsWith('27') && cleaned.length === 11) {
      return '+' + cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '+27' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      return '+27' + cleaned;
    }
    
    return phone; // Return original if we can't normalize
  }

  /**
   * Copy phone number to clipboard with user feedback
   */
  static async copyPhoneToClipboard(phoneNumber: string, showToast?: (type: 'success' | 'error', title: string, message?: string) => void): Promise<boolean> {
    if (!phoneNumber || phoneNumber.trim() === '' || phoneNumber === '-' || phoneNumber === 'N/A') {
      return false;
    }

    try {
      // Clean the phone number for copying (remove formatting but keep readable)
      const cleanedPhone = phoneNumber.trim();
      await navigator.clipboard.writeText(cleanedPhone);

      if (showToast) {
        showToast('success', 'Copied!', `Phone number ${cleanedPhone} copied to clipboard`);
      }

      return true;
    } catch (error) {
      console.error('Failed to copy phone number:', error);

      if (showToast) {
        showToast('error', 'Copy Failed', 'Unable to copy phone number to clipboard');
      }

      return false;
    }
  }

  /**
   * Calculate confidence score based on extracted data
   */
  private static calculateConfidence(data: ParsedMemberData): number {
    let score = 0;

    // Name scoring (increased weight since address is not required for bulk additions)
    if (data.firstName && data.lastName) {
      score += 0.6; // Both names
    } else if (data.firstName || data.lastName) {
      score += 0.3; // One name
    }

    // Phone number scoring (increased weight)
    if (data.phoneNumber) {
      if (data.phoneNumber.startsWith('+27') || data.phoneNumber.length >= 9) {
        score += 0.4; // Good phone number
      } else {
        score += 0.2; // Questionable phone number
      }
    }

    // Address scoring (reduced weight for bulk additions)
    if (data.buildingAddress && data.buildingAddress.length > 5) {
      score += 0.1;
    }

    // Bonus for having name and phone (main requirements for bulk addition)
    if ((data.firstName || data.lastName) && data.phoneNumber) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Add issues and warnings to parsed data
   */
  private static addIssues(data: ParsedMemberData): void {
    if (!data.firstName && !data.lastName) {
      data.issues.push('No name detected');
    } else if (!data.lastName) {
      data.issues.push('Missing last name (single name detected)');
    }

    if (!data.phoneNumber) {
      data.issues.push('No phone number detected');
    } else if (data.phoneNumber.length < 9) {
      data.issues.push('Phone number may be too short');
    }

    // Address is optional for bulk additions, so we don't flag it as an issue
    // if (!data.buildingAddress) {
    //   data.issues.push('No address detected');
    // }

    if (data.confidence < 0.4) { // Lowered threshold since address is optional
      data.issues.push('Low confidence in parsing accuracy');
    }
  }

  /**
   * Convert parsed data to Member format for adding to the system
   */
  static convertToMember(
    parsedData: ParsedMemberData,
    bacentaId: string,
  _joinedDate: string = new Date().toISOString().split('T')[0]
  ): Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> {
    return {
      firstName: parsedData.firstName || 'Unknown',
      lastName: parsedData.lastName || '',
      phoneNumber: parsedData.phoneNumber || '',
      buildingAddress: parsedData.buildingAddress || '',
      profilePicture: '', // No profile picture from text parsing
      bornAgainStatus: false, // Default to false, user can edit later
  speaksInTongues: false,
  baptized: false,
      bacentaId: bacentaId,
      role: 'Member' // Default role
    };
  }
}
