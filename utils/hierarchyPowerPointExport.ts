import PptxGenJS from 'pptxgenjs';
import { Member, Bacenta, AttendanceRecord } from '../types';
import { DirectoryHandle, FileSaveProgress, saveFileToDirectory } from './fileSystemUtils';

import { DEFAULT_CHURCH } from '../constants';
import { isMemberWentHome } from './memberStatus';
import { buildHierarchyGrouping, HierarchySectionKind } from './hierarchyGrouping';
import { getBlob, ref as storageRef } from 'firebase/storage';
import { storage } from '../firebase.config';

export interface HierarchyPowerPointExportOptions {
  directory?: DirectoryHandle | null;
  onSaveProgress?: (progress: FileSaveProgress) => void;
  startDate?: string;
  endDate?: string;
  constituencyName?: string;
  isMinistryContext?: boolean;
  ministryName?: string;
}

export interface HierarchyPowerPointData {
  members: Member[];
  bacentas: Bacenta[];
  attendanceRecords: AttendanceRecord[];
  options: HierarchyPowerPointExportOptions;
}

export interface HierarchyPowerPointPreview {
  memberCount: number;
  estimatedSlides: number;
  features?: string[];
}

const CHURCH_INFO = {
  name: DEFAULT_CHURCH.NAME,
  appName: 'SAT Mobile'
};


const PPT_FONTS = {
  heading: 'Calibri',
  body: 'Calibri'
};

const SECTION_COLORS: Record<HierarchySectionKind, string> = {
  head: '059669',      // Emerald Green
  leader: 'BE123C',    // Crimson Red
  assistant: '3730A3', // Indigo Blue
  member: '475569'     // Slate Grey
};

const formatBirthdayDayMonth = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
};

const getProfileImageDataForPpt = (profilePicture?: string): string | undefined => {
  if (!profilePicture) return undefined;
  if (profilePicture.startsWith('data:')) {
    // Strip `data:` so PptxGenJS gets `image/png;base64,...`
    return profilePicture.substring(5);
  }
  return profilePicture;
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const loadImageAsBase64 = async (url?: string | null): Promise<string | undefined> => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // If already a data URL
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  // If it's a blob URL
  if (trimmed.startsWith('blob:')) {
    try {
      const res = await fetch(trimmed);
      if (res.ok) {
        const blob = await res.blob();
        return await blobToBase64(blob);
      }
    } catch (e) {
      console.warn('Failed to fetch blob URL:', e);
    }
    return undefined;
  }

  // Check if it's a Firebase Storage reference (starts with gs://, firebasestorage.googleapis.com, or is a relative path)
  const isFirebaseStorage = trimmed.startsWith('gs://') || 
                            trimmed.includes('firebasestorage.googleapis.com') ||
                            (!trimmed.startsWith('http://') && 
                             !trimmed.startsWith('https://') && 
                             !trimmed.startsWith('/') && 
                             !trimmed.startsWith('./') && 
                             !trimmed.startsWith('../'));

  if (isFirebaseStorage) {
    try {
      const refInstance = storageRef(storage, trimmed);
      const blob = await getBlob(refInstance);
      return await blobToBase64(blob);
    } catch (e) {
      console.warn(`Failed to load image from Firebase Storage using getBlob for: ${trimmed}`, e);
    }
  }

  // Fallback: try standard fetch
  try {
    const res = await fetch(trimmed);
    if (res.ok) {
      const blob = await res.blob();
      return await blobToBase64(blob);
    }
  } catch (e) {
    console.warn(`Failed to fetch image URL using standard fetch for: ${trimmed}`, e);
  }

  return undefined;
};



const getFullName = (member: Member): string => {
  return `${member.firstName} ${member.lastName || ''}`.trim();
};

const getBacentaName = (bacentas: Bacenta[], bacentaId: string | undefined): string => {
  if (!bacentaId) return '';
  const bacenta = bacentas.find(b => b.id === bacentaId);
  return bacenta ? bacenta.name : '';
};

const getActiveMembers = (members: Member[]): Member[] => {
  return members.filter(m => {
    if (m.isActive === false) return false;
    if (m.frozen && !isMemberWentHome(m)) return false;
    return true;
  });
};


export const getHierarchyPowerPointPreview = (
  data: HierarchyPowerPointData
): HierarchyPowerPointPreview => {
  const activeMembers = getActiveMembers(data.members);
  const memberCount = activeMembers.length;
  const grouping = buildHierarchyGrouping(activeMembers, {
    isMinistryMode: Boolean(data.options?.isMinistryContext),
    ministryName: data.options?.ministryName
  });
  const sectionNames = grouping.sections.map(section => section.title).join(', ');

  return {
    memberCount,
    estimatedSlides: memberCount ? memberCount + 1 : 0,
    features: [
      'Title slide with constituency name',
      `Slides grouped into ${sectionNames || 'all hierarchy levels'}`,
      'Member cards show space for photo and detailed personal, contact and church information'
    ]
  };
};

export const exportHierarchyPowerPoint = async (
  data: HierarchyPowerPointData
): Promise<{ success: boolean; path?: string; error?: string }> => {
  const { members, bacentas, attendanceRecords: _attendanceRecords, options } = data;

  try {
    const activeMembers = getActiveMembers(members);
    const grouping = buildHierarchyGrouping(activeMembers, {
      isMinistryMode: Boolean(options?.isMinistryContext),
      ministryName: options?.ministryName
    });

    // Pre-load all member profile pictures and the app logo to Base64 in parallel
    const imageMap: Record<string, string> = {};
    const membersWithPics = activeMembers.filter(m => m.profilePicture);
    const totalPics = membersWithPics.length;

    let logoBase64: string | undefined = undefined;
    const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : undefined;
    const totalDownloads = totalPics + (logoUrl ? 1 : 0);

    if (totalDownloads > 0) {
      let loadedCount = 0;
      if (options?.onSaveProgress) {
        options.onSaveProgress({
          percent: 10,
          stage: 'saving',
          message: 'Downloading assets...'
        });
      }

      const downloadPromises = membersWithPics.map(async (member) => {
        try {
          const base64 = await loadImageAsBase64(member.profilePicture);
          if (base64) {
            imageMap[member.id] = base64;
          }
        } catch (error) {
          console.error(`Error loading image for member ${member.id}:`, error);
        } finally {
          loadedCount++;
          if (options?.onSaveProgress) {
            const percent = 10 + Math.round((loadedCount / totalDownloads) * 40);
            options.onSaveProgress({
              percent,
              stage: 'saving',
              message: `Downloading profile pictures (${loadedCount}/${totalPics})...`
            });
          }
        }
      });

      if (logoUrl) {
        downloadPromises.push((async () => {
          try {
            logoBase64 = await loadImageAsBase64(logoUrl);
          } catch (error) {
            console.error('Error loading logo:', error);
          } finally {
            loadedCount++;
            if (options?.onSaveProgress) {
              const percent = 10 + Math.round((loadedCount / totalDownloads) * 40);
              options.onSaveProgress({
                percent,
                stage: 'saving',
                message: 'Downloading branding assets...'
              });
            }
          }
        })());
      }

      await Promise.all(downloadPromises);
    }

    const pptx = new PptxGenJS();
    const reportName = options?.constituencyName || CHURCH_INFO.name;

    // Title slide
    const titleSlide = pptx.addSlide();

    // Soft background panel (dark slate)
    titleSlide.addText('', {
      x: 0,
      y: 0,
      w: 10,
      h: 5.625,
      fill: { color: '0F172A' }
    });

    // Geometric accent shapes
    titleSlide.addShape('rect', {
      x: 6.5,
      y: -0.5,
      w: 4.5,
      h: 6.625,
      fill: { type: 'solid', color: '1E293B' },
      rotate: 15
    });

    titleSlide.addShape('rect', {
      x: 7.2,
      y: 0.5,
      w: 3.5,
      h: 5.0,
      fill: { type: 'solid', color: '38BDF8', alpha: 15 },
      rotate: 15
    });

    // Accent block and Logo on the right (only show if we successfully loaded the logo to avoid empty placeholder frames)
    if (logoBase64) {
      const cleanLogoBase64 = getProfileImageDataForPpt(logoBase64);
      if (cleanLogoBase64) {
        titleSlide.addShape('rect', {
          x: 7.0,
          y: 1.5,
          w: 2.2,
          h: 2.2,
          fill: { color: 'FFFFFF' },
          line: { color: 'E2E8F0', width: 2 },
          rectRadius: 0.1
        });

        titleSlide.addImage({
          data: cleanLogoBase64,
          x: 7.15,
          y: 1.65,
          w: 1.9,
          h: 1.9,
          sizing: {
            type: 'contain',
            w: 1.9,
            h: 1.9
          }
        });
      }
    }

    const contentW = logoBase64 ? 5.8 : 8.2;

    // Membership report banner tag
    titleSlide.addShape('rect', {
      x: 0.9,
      y: 1.1,
      w: 2.2,
      h: 0.35,
      fill: { color: '38BDF8' },
      rectRadius: 0.17
    });

    titleSlide.addText("MEMBERSHIP REPORT", {
      x: 0.9,
      y: 1.1,
      w: 2.2,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: '0F172A',
      align: 'center',
      valign: 'middle',
      fontFace: PPT_FONTS.body
    });

    // Main title
    titleSlide.addText(`${reportName}`, {
      x: 0.9,
      y: 1.6,
      w: contentW,
      h: 1.6,
      fontSize: 38,
      bold: true,
      color: 'FFFFFF',
      align: 'left',
      fontFace: PPT_FONTS.heading
    });

    // Subtitle
    titleSlide.addText(`Directory & Hierarchy Profiles\nGenerated via ${CHURCH_INFO.appName}`, {
      x: 0.9,
      y: 3.3,
      w: contentW,
      h: 0.8,
      fontSize: 16,
      color: '94A3B8',
      align: 'left',
      fontFace: PPT_FONTS.body
    });

    // Metadata Footer
    const dateText = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    titleSlide.addText([
      { text: `Total Active Members: `, options: { color: '94A3B8', bold: true } },
      { text: `${activeMembers.length}     `, options: { color: '38BDF8', bold: true } },
      { text: `Date: `, options: { color: '94A3B8', bold: true } },
      { text: dateText, options: { color: 'FFFFFF' } }
    ], {
      x: 0.9,
      y: 4.4,
      w: 8.2,
      h: 0.4,
      fontSize: 12,
      fontFace: PPT_FONTS.body
    });

    const addSectionSlides = (
      title: string,
      sectionMembers: Member[],
      color: string
    ) => {
      if (!sectionMembers.length) return;

      const perSlide = 1;
      const marginLeft = 0.6;
      const marginTop = 1.1;

      let slide = pptx.addSlide();
      let indexOnSlide = 0;

      const addHeader = () => {
        // Slide background panel (soft slate blue/white for premium feel)
        slide.addText('', {
          x: 0,
          y: 0,
          w: 10,
          h: 5.625,
          fill: { color: 'F8FAFC' }
        });

        // Header container
        slide.addShape('rect', {
          x: 0.6,
          y: 0.25,
          w: 8.8,
          h: 0.65,
          fill: { color: 'FFFFFF' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.04
        });

        // Colored vertical accent indicator
        slide.addShape('rect', {
          x: 0.6,
          y: 0.25,
          w: 0.12,
          h: 0.65,
          fill: { color }
        });

        // Section Title
        slide.addText(title, {
          x: 0.9,
          y: 0.3,
          w: 6.0,
          h: 0.55,
          fontSize: 20,
          bold: true,
          color,
          align: 'left',
          valign: 'middle',
          fontFace: PPT_FONTS.heading
        });

        // Right info caption
        slide.addText('SAT Mobile Member Directory', {
          x: 6.8,
          y: 0.3,
          w: 2.4,
          h: 0.55,
          fontSize: 10,
          color: '64748B',
          align: 'right',
          valign: 'middle',
          fontFace: PPT_FONTS.body
        });
      };

      addHeader();

      sectionMembers.forEach(member => {
        if (indexOnSlide >= perSlide) {
          slide = pptx.addSlide();
          indexOnSlide = 0;
          addHeader();
        }

        const x = marginLeft;
        const y = marginTop;

        // ================= LEFT COLUMN (PROFILE CARD) =================
        
        // Card background container
        slide.addShape('rect', {
          x,
          y,
          w: 2.8,
          h: 4.15,
          fill: { color: 'FFFFFF' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.08
        });

        // Photo Frame placeholder background
        slide.addShape('rect', {
          x: x + 0.2,
          y: y + 0.2,
          w: 2.4,
          h: 2.4,
          fill: { color: 'F1F5F9' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.06
        });

        const base64Data = member.profilePicture ? imageMap[member.id] : undefined;
        const profileImageData = getProfileImageDataForPpt(base64Data);

        if (profileImageData) {
          slide.addImage({
            data: profileImageData,
            x: x + 0.22,
            y: y + 0.22,
            w: 2.36,
            h: 2.36,
            sizing: {
              type: 'cover',
              w: 2.36,
              h: 2.36
            },
            altText: getFullName(member)
          });
        } else {
          // Draw a stylish default avatar silhouette
          slide.addText('👤\nNo Photo', {
            x: x + 0.2,
            y: y + 0.2,
            w: 2.4,
            h: 2.4,
            fontSize: 14,
            align: 'center',
            valign: 'middle',
            color: '94A3B8',
            fontFace: PPT_FONTS.body
          });
        }

        // Member Name
        slide.addText(getFullName(member), {
          x: x + 0.1,
          y: y + 2.75,
          w: 2.6,
          h: 0.6,
          fontSize: 16,
          bold: true,
          color: '1E293B',
          align: 'center',
          valign: 'middle',
          fontFace: PPT_FONTS.heading
        });

        // Hierarchy Role Badge
        let roleLabel = member.role || 'Member';
        slide.addShape('rect', {
          x: x + 0.3,
          y: y + 3.45,
          w: 2.2,
          h: 0.35,
          fill: { color },
          rectRadius: 0.06
        });

        slide.addText(roleLabel, {
          x: x + 0.3,
          y: y + 3.45,
          w: 2.2,
          h: 0.35,
          fontSize: 10,
          bold: true,
          color: 'FFFFFF',
          align: 'center',
          valign: 'middle',
          fontFace: PPT_FONTS.body
        });

        // ================= RIGHT COLUMN (DETAIL CARDS) =================
        
        const contentX = x + 3.0;
        const bacentaName = getBacentaName(bacentas, member.bacentaId);

        // Prepare details
        const phoneText = member.phoneNumber || 'Not recorded';
        
        let homeAddressText = 'Not recorded';
        if (member.buildingAddress && member.roomNumber) {
          homeAddressText = `${member.buildingAddress} • Room ${member.roomNumber}`;
        } else if (member.buildingAddress) {
          homeAddressText = member.buildingAddress;
        } else if (member.roomNumber) {
          homeAddressText = `Room ${member.roomNumber}`;
        }

        let ministryText = 'Not recorded';
        if (member.ministry && member.ministryPosition) {
          ministryText = `${member.ministry} • ${member.ministryPosition}`;
        } else if (member.ministry) {
          ministryText = member.ministry;
        } else if (member.ministryPosition) {
          ministryText = member.ministryPosition;
        }

        const bacentaText = bacentaName || 'Not recorded';
        const birthdayText = member.birthday ? formatBirthdayDayMonth(member.birthday) : 'Not recorded';

        const tonguesText =
          typeof member.speaksInTongues === 'boolean'
            ? member.speaksInTongues
              ? 'Yes'
              : 'No'
            : 'Not recorded';

        const baptizedText =
          typeof member.baptized === 'boolean' ? (member.baptized ? 'Yes' : 'No') : 'Not recorded';

        // CARD 1: Contact & Personal Details
        slide.addShape('rect', {
          x: contentX,
          y,
          w: 5.8,
          h: 1.95,
          fill: { color: 'FFFFFF' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.08
        });

        // Left colored stripe indicator
        slide.addShape('rect', {
          x: contentX,
          y,
          w: 0.08,
          h: 1.95,
          fill: { color }
        });

        slide.addText([
          { text: "CONTACT & PERSONAL\n", options: { bold: true, fontSize: 9, color } },
          { text: "\n", options: { fontSize: 4 } },
          { text: "Phone Number\n", options: { bold: true, fontSize: 9.5, color: '64748B' } },
          { text: phoneText + "\n\n", options: { fontSize: 11.5, color: '1E293B' } },
          { text: "Home Address\n", options: { bold: true, fontSize: 9.5, color: '64748B' } },
          { text: homeAddressText + "\n\n", options: { fontSize: 11.5, color: '1E293B' } },
          { text: "Birthday\n", options: { bold: true, fontSize: 9.5, color: '64748B' } },
          { text: birthdayText, options: { fontSize: 11.5, color: '1E293B' } }
        ], {
          x: contentX + 0.25,
          y: y + 0.15,
          w: 5.3,
          h: 1.65,
          fontFace: PPT_FONTS.body,
          valign: 'top'
        });

        // CARD 2: Church & Spiritual Growth Details
        const card2Y = y + 2.15;
        slide.addShape('rect', {
          x: contentX,
          y: card2Y,
          w: 5.8,
          h: 2.0,
          fill: { color: 'FFFFFF' },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.08
        });

        // Left colored stripe indicator
        slide.addShape('rect', {
          x: contentX,
          y: card2Y,
          w: 0.08,
          h: 2.0,
          fill: { color }
        });

        // Left side of Card 2 (Church Details)
        slide.addText([
          { text: "CHURCH & MINISTRY\n", options: { bold: true, fontSize: 9, color } },
          { text: "\n", options: { fontSize: 4 } },
          { text: "Bacenta\n", options: { bold: true, fontSize: 9.5, color: '64748B' } },
          { text: bacentaText + "\n\n", options: { fontSize: 11.5, color: '1E293B' } },
          { text: "Ministry\n", options: { bold: true, fontSize: 9.5, color: '64748B' } },
          { text: ministryText, options: { fontSize: 11.5, color: '1E293B' } }
        ], {
          x: contentX + 0.25,
          y: card2Y + 0.15,
          w: 2.8,
          h: 1.7,
          fontFace: PPT_FONTS.body,
          valign: 'top'
        });

        // Right side of Card 2 (Spiritual Badges)
        const badgeX = contentX + 3.25;
        slide.addText("SPIRITUAL GROWTH", {
          x: badgeX,
          y: card2Y + 0.15,
          w: 2.3,
          h: 0.25,
          fontSize: 9,
          bold: true,
          color,
          fontFace: PPT_FONTS.body
        });

        // Helper to draw a pill badge
        const drawBadge = (
          by: number, 
          label: string, 
          statusValue: boolean | string
        ) => {
          let bgColor = 'F1F5F9';
          let textColor = '475569';
          let text = `${label}: No`;
          
          if (statusValue === true || statusValue === 'Yes') {
            text = `${label}: Yes`;
            if (label === 'Born Again') {
              bgColor = 'E6F4EA';
              textColor = '137333';
            } else if (label === 'Prays in Tongues') {
              bgColor = 'F3E8FF';
              textColor = '6B21A8';
            } else if (label === 'Water Baptized') {
              bgColor = 'E0F2FE';
              textColor = '0369A1';
            }
          } else if (statusValue === 'Not recorded') {
            text = `${label}: Unknown`;
            bgColor = 'F8FAFC';
            textColor = '94A3B8';
          } else {
            if (label === 'Born Again' || label === 'Water Baptized') {
              bgColor = 'FCE8E6';
              textColor = 'C5221F';
            }
          }

          // Draw pill background
          slide.addShape('rect', {
            x: badgeX,
            y: by,
            w: 2.3,
            h: 0.35,
            fill: { color: bgColor },
            line: { color: bgColor, width: 0.5 },
            rectRadius: 0.17
          });

          // Draw pill text
          slide.addText(text, {
            x: badgeX,
            y: by,
            w: 2.3,
            h: 0.35,
            fontSize: 9.5,
            bold: true,
            color: textColor,
            align: 'center',
            valign: 'middle',
            fontFace: PPT_FONTS.body
          });
        };

        drawBadge(card2Y + 0.5, 'Born Again', member.bornAgainStatus ? 'Yes' : 'No');
        drawBadge(card2Y + 0.95, 'Prays in Tongues', tonguesText === 'Yes' ? true : tonguesText === 'No' ? false : 'Not recorded');
        drawBadge(card2Y + 1.4, 'Water Baptized', baptizedText === 'Yes' ? true : baptizedText === 'No' ? false : 'Not recorded');

        indexOnSlide += 1;
      });
    };

    grouping.sections.forEach(section => {
      if (!section.members.length) return;

      // 1. Create a beautiful section divider slide
      const dividerSlide = pptx.addSlide();
      const sectionColor = SECTION_COLORS[section.kind] || '595959';

      // Background theme color
      dividerSlide.addText('', {
        x: 0,
        y: 0,
        w: 10,
        h: 5.625,
        fill: { color: sectionColor }
      });

      // Translucent layout border frame
      dividerSlide.addShape('rect', {
        x: 0.5,
        y: 0.5,
        w: 9.0,
        h: 4.625,
        line: { color: 'FFFFFF', width: 2 },
        rectRadius: 0.05
      });

      // Section label
      dividerSlide.addText("SECTION DIRECTORY", {
        x: 1.0,
        y: 1.6,
        w: 8.0,
        h: 0.4,
        fontSize: 14,
        bold: true,
        color: 'E2E8F0',
        align: 'left',
        fontFace: PPT_FONTS.body
      });

      // Large section title
      dividerSlide.addText(section.title, {
        x: 1.0,
        y: 2.0,
        w: 8.0,
        h: 1.2,
        fontSize: 48,
        bold: true,
        color: 'FFFFFF',
        align: 'left',
        fontFace: PPT_FONTS.heading
      });

      // Count registered members
      const memberCountText = `${section.members.length} Active ${
        section.members.length === 1 ? 'Profile' : 'Profiles'
      } Registered`;
      dividerSlide.addText(memberCountText, {
        x: 1.0,
        y: 3.3,
        w: 8.0,
        h: 0.5,
        fontSize: 20,
        color: 'F1F5F9',
        align: 'left',
        fontFace: PPT_FONTS.body
      });

      // Line divider
      dividerSlide.addShape('line', {
        x: 1.0,
        y: 4.0,
        w: 4.0,
        h: 0.0,
        line: { color: 'FFFFFF', width: 3 }
      });

      // 2. Add actual profile slides
      addSectionSlides(section.title, section.members, sectionColor);
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = reportName.replace(/\s+/g, '-');
    const filename = `${safeName}-Hierarchy-Attendance-${timestamp}.pptx`;

    const buffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;

    const result = await saveFileToDirectory(
      options.directory || null,
      filename,
      buffer,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      options.onSaveProgress
    );

    return result;
  } catch (error: any) {
    console.error('Hierarchy PowerPoint export failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to export hierarchy PowerPoint file'
    };
  }
};

