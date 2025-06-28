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
    /(\+27\d{9})/g, // +27821234567
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
  private static parseLine(line: string, lineNumber: number): ParsedMemberData | null {
    if (!line || line.length < 3) {
      return null; // Skip very short lines
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
    const phoneNumbers = this.extractPhoneNumbers(line);
    if (phoneNumbers.length > 0) {
      result.phoneNumber = this.normalizePhoneNumber(phoneNumbers[0]);
      // Remove phone number from line for further processing
      line = line.replace(phoneNumbers[0], '').trim();
    }

    // Extract email if present
    const emails = line.match(this.EMAIL_PATTERN);
    if (emails && emails.length > 0) {
      // For now, we don't have an email field, but we could add it to address or notes
      line = line.replace(emails[0], '').trim();
    }

    // Try to extract names
    const nameMatch = this.extractNames(line);
    if (nameMatch) {
      result.firstName = nameMatch.firstName;
      result.lastName = nameMatch.lastName;
      // Remove names from line for address extraction
      line = line.replace(nameMatch.fullMatch, '').trim();
    }

    // Remaining text could be address
    if (line.length > 0) {
      result.buildingAddress = line;
    }

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
    // Try different approaches to extract names
    
    // Approach 1: Simple two-word pattern
    const simpleMatch = text.match(this.NAME_PATTERN);
    if (simpleMatch) {
      return {
        firstName: simpleMatch[1].trim(),
        lastName: simpleMatch[2].trim(),
        fullMatch: simpleMatch[0]
      };
    }

    // Approach 2: First two words if they look like names
    const words = text.split(/\s+/).filter(word => word.length > 0);
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
   * Calculate confidence score based on extracted data
   */
  private static calculateConfidence(data: ParsedMemberData): number {
    let score = 0;
    
    // Name scoring
    if (data.firstName && data.lastName) {
      score += 0.4; // Both names
    } else if (data.firstName || data.lastName) {
      score += 0.2; // One name
    }
    
    // Phone number scoring
    if (data.phoneNumber) {
      if (data.phoneNumber.startsWith('+27') || data.phoneNumber.length >= 9) {
        score += 0.3; // Good phone number
      } else {
        score += 0.1; // Questionable phone number
      }
    }
    
    // Address scoring
    if (data.buildingAddress && data.buildingAddress.length > 5) {
      score += 0.2;
    }
    
    // Bonus for having all fields
    if (data.firstName && data.lastName && data.phoneNumber && data.buildingAddress) {
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
    } else if (!data.firstName) {
      data.issues.push('Missing first name');
    } else if (!data.lastName) {
      data.issues.push('Missing last name');
    }
    
    if (!data.phoneNumber) {
      data.issues.push('No phone number detected');
    } else if (data.phoneNumber.length < 9) {
      data.issues.push('Phone number may be too short');
    }
    
    if (!data.buildingAddress) {
      data.issues.push('No address detected');
    }
    
    if (data.confidence < 0.5) {
      data.issues.push('Low confidence in parsing accuracy');
    }
  }

  /**
   * Convert parsed data to Member format for adding to the system
   */
  static convertToMember(
    parsedData: ParsedMemberData, 
    bacentaId: string, 
    joinedDate: string = new Date().toISOString().split('T')[0]
  ): Omit<Member, 'id' | 'createdDate' | 'lastUpdated'> {
    return {
      firstName: parsedData.firstName || 'Unknown',
      lastName: parsedData.lastName || '',
      phoneNumber: parsedData.phoneNumber || '',
      buildingAddress: parsedData.buildingAddress || '',
      bornAgainStatus: false, // Default to false, user can edit later
      bacentaId: bacentaId,
      joinedDate: joinedDate
    };
  }
}
