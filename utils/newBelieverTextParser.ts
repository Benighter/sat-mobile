import { NewBeliever } from '../types';
import { formatDateToYYYYMMDD } from './dateUtils';

export interface ParsedNewBelieverData {
  name: string;
  surname: string;
  contact: string;
  dateOfBirth: string;
  residence: string;
  studies: string;
  campus: string;
  occupation: string;
  year: string;
  isFirstTime: boolean;
  ministry: string;
  joinedDate: string; // Will be extracted from date sections
  rawText: string; // Original text for reference
  confidence: number; // 0-1 score indicating parsing confidence
  issues: string[]; // Array of potential issues or warnings
}

export interface NewBelieverParseResult {
  newBelievers: ParsedNewBelieverData[];
  totalLines: number;
  successfullyParsed: number;
  errors: string[];
}

/**
 * Smart text parser for structured new believer data
 * Handles format: Date sections followed by structured believer data
 * Example:
 * 9-Mar-25 (Date)
 * # Name Surname Contact DOB Residence Studies Campus Occupation Year First Time? Ministry
 * 1 Mmesoma Shongwe 0640445822 25/02/2007 Jubilee Wits Campus Accounting Science Wits Main Student 1st No, Rededication Dancing Stars
 */
export class NewBelieverTextParser {
  
  /**
   * Parse pasted text and extract new believer information
   */
  static parseText(text: string): NewBelieverParseResult {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const newBelievers: ParsedNewBelieverData[] = [];
    const errors: string[] = [];
    let currentJoinedDate = formatDateToYYYYMMDD(new Date()); // Default to today

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        // Check if this is a date header line
        const dateMatch = this.extractDateFromHeader(line);
        if (dateMatch) {
          currentJoinedDate = dateMatch;
          continue;
        }

        // Skip header lines that start with #
        if (line.startsWith('#')) {
          continue;
        }

        // Try to parse as believer data
        const parsed = this.parseBelieverLine(line, currentJoinedDate);
        if (parsed) {
          newBelievers.push(parsed);
        }
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      newBelievers,
      totalLines: lines.length,
      successfullyParsed: newBelievers.length,
      errors
    };
  }

  /**
   * Extract date from header lines like "9-Mar-25 (Date)"
   */
  private static extractDateFromHeader(line: string): string | null {
    // Pattern for date headers like "9-Mar-25 (Date)" or "9-Mar-25"
    const dateHeaderPattern = /(\d{1,2}-[A-Za-z]{3}-\d{2,4})/;
    const match = line.match(dateHeaderPattern);
    
    if (match) {
      try {
        const dateStr = match[1];
        // Convert "9-Mar-25" to proper date format
        const [day, month, year] = dateStr.split('-');
        const monthMap: { [key: string]: string } = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
          'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
          'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        
        const monthNum = monthMap[month];
        const fullYear = year.length === 2 ? `20${year}` : year;
        
        if (monthNum) {
          return `${fullYear}-${monthNum}-${day.padStart(2, '0')}`;
        }
      } catch (error) {
        // If date parsing fails, continue without setting date
      }
    }
    
    return null;
  }

  /**
   * Parse a structured believer data line
   * Expected format: Number Name Surname Contact DOB Residence Studies Campus Occupation Year FirstTime Ministry
   */
  private static parseBelieverLine(line: string, joinedDate: string): ParsedNewBelieverData | null {
    if (!line || line.length < 10) {
      return null;
    }

    // Remove leading number and normalize spaces
    const cleanedLine = line.replace(/^\d+\s*/, '').trim();
    
    if (!cleanedLine) {
      return null;
    }

    // Use intelligent parsing to split the line into fields
    const fields = this.intelligentSplit(cleanedLine);

    if (fields.length < 3) {
      return null; // Need at least name, surname, contact
    }

    const result: ParsedNewBelieverData = {
      name: '',
      surname: '',
      contact: '',
      dateOfBirth: '',
      residence: '',
      studies: '',
      campus: '',
      occupation: '',
      year: '',
      isFirstTime: false,
      ministry: '',
      joinedDate: joinedDate,
      rawText: line,
      confidence: 0,
      issues: []
    };

    // Map fields based on expected structure
    // Expected: Name Surname Contact DOB Residence Studies Campus Occupation Year FirstTime Ministry
    let fieldIndex = 0;
    
    if (fields[fieldIndex]) result.name = fields[fieldIndex++];
    if (fields[fieldIndex]) result.surname = fields[fieldIndex++];
    if (fields[fieldIndex]) result.contact = this.normalizeContact(fields[fieldIndex++]);
    if (fields[fieldIndex]) result.dateOfBirth = this.normalizeDateOfBirth(fields[fieldIndex++]);
    if (fields[fieldIndex]) result.residence = fields[fieldIndex++];
    if (fields[fieldIndex]) result.studies = fields[fieldIndex++];
    if (fields[fieldIndex]) result.campus = fields[fieldIndex++];
    if (fields[fieldIndex]) result.occupation = fields[fieldIndex++];
    if (fields[fieldIndex]) result.year = fields[fieldIndex++];
    
    // Parse remaining fields for first time status and ministry
    const remaining = fields.slice(fieldIndex).join(' ');
    result.isFirstTime = this.parseFirstTime(remaining);
    result.ministry = this.extractMinistry(remaining);

    // Calculate confidence and add issues
    result.confidence = this.calculateConfidence(result);
    this.addIssues(result);

    return result.name ? result : null;
  }

  /**
   * Intelligently split line into fields by detecting patterns
   */
  private static intelligentSplit(line: string): string[] {
    const fields: string[] = [];
    const words = line.split(/\s+/);
    let currentField = '';
    let fieldIndex = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Field 0: Name (single word usually)
      if (fieldIndex === 0) {
        fields.push(word);
        fieldIndex++;
        continue;
      }
      
      // Field 1: Surname (single word usually)
      if (fieldIndex === 1) {
        fields.push(word);
        fieldIndex++;
        continue;
      }
      
      // Field 2: Contact (phone number)
      if (fieldIndex === 2 && this.isContact(word)) {
        fields.push(word);
        fieldIndex++;
        continue;
      }
      
      // Field 3: Date of Birth
      if (fieldIndex === 3 && this.isDateOfBirth(word)) {
        fields.push(word);
        fieldIndex++;
        continue;
      }
      
      // For remaining fields, build up phrases until we hit specific patterns
      if (currentField) {
        currentField += ' ' + word;
      } else {
        currentField = word;
      }
      
      // Check if we should end current field
      if (this.shouldEndField(currentField, fieldIndex, words, i)) {
        fields.push(currentField);
        currentField = '';
        fieldIndex++;
      }
    }
    
    // Add remaining field if any
    if (currentField) {
      fields.push(currentField);
    }
    
    return fields;
  }

  /**
   * Check if a string looks like a contact number
   */
  private static isContact(str: string): boolean {
    return /^[0-9+\-\s()]+$/.test(str) && str.length >= 7;
  }

  /**
   * Check if a string looks like a date of birth
   */
  private static isDateOfBirth(str: string): boolean {
    return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str);
  }

  /**
   * Determine if we should end the current field
   */
  private static shouldEndField(field: string, fieldIndex: number, allWords: string[], currentIndex: number): boolean {
    const nextWord = allWords[currentIndex + 1];
    
    switch (fieldIndex) {
      case 4: // Residence - end when we see academic terms or if field is long enough
        return field.split(' ').length >= 2 || /BSc|BA|BCom|BEng|Accounting|Science|Arts|Engineering/i.test(nextWord || '');
      case 5: // Studies - end when we see campus terms
        return /Campus|Wits|UCT|UJ|University/i.test(nextWord || '');
      case 6: // Campus - end when we see occupation terms
        return /Student|Engineer|Doctor|Teacher|Main/i.test(nextWord || '');
      case 7: // Occupation - end when we see year terms
        return /1st|2nd|3rd|4th|Year|Final|Student/i.test(nextWord || '');
      case 8: // Year - end when we see first time terms
        return /No|Yes|First|Rededication/i.test(nextWord || '');
      default:
        return false;
    }
  }

  /**
   * Normalize contact information
   */
  private static normalizeContact(contact: string): string {
    // Remove non-digit characters except +
    let normalized = contact.replace(/[^\d+]/g, '');
    
    // If it's a 10-digit number starting with 0, convert to +27 format
    if (/^0\d{9}$/.test(normalized)) {
      return '+27' + normalized.substring(1);
    }
    
    // If it's a 9-digit number, add +27
    if (/^\d{9}$/.test(normalized)) {
      return '+27' + normalized;
    }
    
    return contact; // Return original if can't normalize
  }

  /**
   * Normalize date of birth from DD/MM/YYYY to YYYY-MM-DD
   */
  private static normalizeDateOfBirth(dob: string): string {
    const match = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dob; // Return original if can't parse
  }

  /**
   * Parse first time visitor status
   */
  private static parseFirstTime(text: string): boolean {
    const lowerText = text.toLowerCase();
    // Look for positive indicators
    if (lowerText.includes('1st') || lowerText.includes('first') || lowerText.includes('yes')) {
      return true;
    }
    // Look for negative indicators (rededication)
    if (lowerText.includes('no') || lowerText.includes('rededication')) {
      return false;
    }
    return false; // Default to false
  }

  /**
   * Extract ministry from text
   */
  private static extractMinistry(text: string): string {
    const ministries = ['Choir', 'Dancing Stars', 'Ushers', 'Arrival Stars', 'Airport Stars', 'Media'];
    
    for (const ministry of ministries) {
      if (text.toLowerCase().includes(ministry.toLowerCase())) {
        return ministry;
      }
    }
    return ''; // Return empty if no ministry found
  }

  /**
   * Calculate confidence score based on available data
   */
  private static calculateConfidence(data: ParsedNewBelieverData): number {
    let score = 0;
    let maxScore = 0;

    // Name (required)
    maxScore += 30;
    if (data.name && data.name.length > 1) score += 30;

    // Surname
    maxScore += 20;
    if (data.surname && data.surname.length > 1) score += 20;

    // Contact
    maxScore += 20;
    if (data.contact && (data.contact.includes('+') || data.contact.length >= 10)) score += 20;

    // Date of Birth
    maxScore += 10;
    if (data.dateOfBirth && data.dateOfBirth.includes('-')) score += 10;

    // Other fields
    maxScore += 20;
    if (data.residence) score += 3;
    if (data.studies) score += 3;
    if (data.campus) score += 3;
    if (data.occupation) score += 3;
    if (data.year) score += 3;
    if (data.ministry) score += 5;

    return Math.min(score / maxScore, 1.0);
  }

  /**
   * Add issues and warnings based on parsed data
   */
  private static addIssues(data: ParsedNewBelieverData): void {
    if (!data.name) {
      data.issues.push('No name detected');
    }

    if (!data.surname) {
      data.issues.push('No surname detected');
    }

    if (!data.contact) {
      data.issues.push('No contact information found');
    } else if (!data.contact.includes('+') && data.contact.length < 10) {
      data.issues.push('Contact might be invalid');
    }

    if (!data.dateOfBirth) {
      data.issues.push('No date of birth provided');
    }

    if (data.name && data.name.length < 2) {
      data.issues.push('Name seems too short');
    }

    if (!data.ministry) {
      data.issues.push('No ministry specified');
    }
  }

  /**
   * Convert parsed data to NewBeliever format for database insertion
   */
  static convertToNewBeliever(parsedData: ParsedNewBelieverData): Omit<NewBeliever, 'id' | 'createdDate' | 'lastUpdated'> {
    return {
      name: parsedData.name,
      surname: parsedData.surname || '',
      contact: parsedData.contact || '',
      dateOfBirth: parsedData.dateOfBirth || '',
      residence: parsedData.residence || '',
      studies: parsedData.studies || '',
      campus: parsedData.campus || '',
      occupation: parsedData.occupation || '',
      year: parsedData.year || '',
      isFirstTime: parsedData.isFirstTime,
      ministry: parsedData.ministry || '',
      joinedDate: parsedData.joinedDate,
    };
  }
}
