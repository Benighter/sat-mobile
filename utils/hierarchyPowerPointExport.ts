import PptxGenJS from 'pptxgenjs';
import { Member, Bacenta, AttendanceRecord } from '../types';
import { DirectoryHandle, saveFileToDirectory } from './fileSystemUtils';

import { DEFAULT_CHURCH } from '../constants';

export interface HierarchyPowerPointExportOptions {
  directory?: DirectoryHandle | null;
  startDate?: string;
  endDate?: string;
  constituencyName?: string;
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



const getFullName = (member: Member): string => {
  return `${member.firstName} ${member.lastName || ''}`.trim();
};

const getBacentaName = (bacentas: Bacenta[], bacentaId: string | undefined): string => {
  if (!bacentaId) return '';
  const bacenta = bacentas.find(b => b.id === bacentaId);
  return bacenta ? bacenta.name : '';
};

const getActiveMembers = (members: Member[]): Member[] => {
  return members.filter(m => !m.frozen && m.isActive !== false);
};


export const getHierarchyPowerPointPreview = (
  data: HierarchyPowerPointData
): HierarchyPowerPointPreview => {
  const activeMembers = getActiveMembers(data.members);
  const memberCount = activeMembers.length;

  return {
    memberCount,
    estimatedSlides: memberCount ? memberCount + 1 : 0,
    features: [
      'Title slide with constituency name',
      'Slides grouped into Green Bacentas, Red Bacentas, Assistants, Members',
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

    const pptx = new PptxGenJS();
    const reportName = options?.constituencyName || CHURCH_INFO.name;

    // Title slide
    const titleSlide = pptx.addSlide();

    // Soft background panel
    titleSlide.addText('', {
      x: 0,
      y: 0,
      w: 10,
      h: 5.625,
      fill: { color: 'F8FBFF' }
    });

    // Top accent bar
    titleSlide.addText('', {
      x: 0,
      y: 0,
      w: 10,
      h: 0.6,
      fill: { color: '203864' }
    });

    // Accent block on the right
    titleSlide.addText('', {
      x: 7.2,
      y: 1.1,
      w: 2.3,
      h: 2.0,
      fill: { color: 'E6F4EA' },
      line: { color: 'CFE8D9', width: 1 }
    });

    // Main title
    titleSlide.addText(`${reportName} Member Report`, {
      x: 0.9,
      y: 1.3,
      w: 6.5,
      h: 1.4,
      fontSize: 36,
      bold: true,
      color: '203864',
      align: 'left',
      fontFace: PPT_FONTS.heading
    });

    // Subtitle
    titleSlide.addText(`Profiles from ${CHURCH_INFO.appName}`, {
      x: 0.9,
      y: 2.4,
      w: 6.5,
      h: 0.8,
      fontSize: 18,
      color: '555555',
      align: 'left',
      fontFace: PPT_FONTS.body
    });

    const sortByName = (a: Member, b: Member) => getFullName(a).localeCompare(getFullName(b));

    const greenBacentas = activeMembers.filter(m => m.role === 'Bacenta Leader').sort(sortByName);
    const redBacentas = activeMembers.filter(m => m.role === 'Fellowship Leader').sort(sortByName);
    const assistants = activeMembers.filter(m => m.role === 'Assistant' || m.role === 'Admin').sort(sortByName);
    const membersOnly = activeMembers.filter(m =>
      m.role !== 'Bacenta Leader' &&
      m.role !== 'Fellowship Leader' &&
      m.role !== 'Assistant' &&
      m.role !== 'Admin'
    ).sort(sortByName);

    const addSectionSlides = (
      title: string,
      sectionMembers: Member[],
      color: string
    ) => {
      if (!sectionMembers.length) return;

      const perSlide = 1;
      const cardW = 8.8;
      const cardH = 3.6;
      const marginLeft = 0.8;
      const marginTop = 1.2;
      const vGap = 0.3;

      let slide = pptx.addSlide();
      let indexOnSlide = 0;

      const addHeader = () => {
        // Vertical color strip
        slide.addText('', {
          x: 0,
          y: 0,
          w: 0.25,
          h: 5.625,
          fill: { color }
        });

        // Soft header band
        slide.addText('', {
          x: 0.25,
          y: 0.25,
          w: 9.5,
          h: 0.75,
          fill: { color: 'F4F6FB' },
          line: { color: 'E0E4F2', width: 1 }
        });

        // Section title
        slide.addText(title, {
          x: 0.6,
          y: 0.38,
          w: 6.0,
          h: 0.5,
          fontSize: 26,
          bold: true,
          color,
          align: 'left',
          fontFace: PPT_FONTS.heading
        });

        // Small caption on the right
        slide.addText('Member profiles', {
          x: 6.8,
          y: 0.4,
          w: 2.8,
          h: 0.4,
          fontSize: 11,
          color: '666666',
          align: 'right',
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

        const row = indexOnSlide;
        const x = marginLeft;
        const y = marginTop + row * (cardH + vGap);

        // Card background panel
        slide.addText('', {
          x: x - 0.1,
          y: y - 0.1,
          w: cardW,
          h: cardH + 0.8,
          fill: { color: 'FFFFFF' },
          line: { color: 'E5E5E5', width: 1 }
        });

        // Photo frame
        slide.addText('', {
          x,
          y,
          w: 2.1,
          h: cardH,
          fill: { color: 'EDEDED' },
          line: { color: 'BFBFBF', width: 1 }
        });

        const profileImageData = getProfileImageDataForPpt(member.profilePicture);

        if (profileImageData) {
          // Keep aspect ratio: fit nicely inside the wider photo frame without squishing
          slide.addImage({
            data: profileImageData,
            x: x + 0.05,
            y: y + 0.05,
            w: 2.0,
            h: cardH - 0.1,
            sizing: {
              type: 'cover',
              w: 2.0,
              h: cardH - 0.1
            },
            altText: getFullName(member)
          });
        } else {
          slide.addText('Photo', {
            x,
            y,
            w: 2.1,
            h: cardH,
            fontSize: 10,
            align: 'center',
            color: '7F7F7F'
          });
        }

        const contentX = x + 2.4;
        const contentWidth = cardW - 2.8;
        const bacentaName = getBacentaName(bacentas, member.bacentaId);

        // Member name as a clear heading
        slide.addText(getFullName(member), {
          x: contentX,
          y: y + 0.1,
          w: contentWidth,
          h: 0.6,
          fontSize: 24,
          bold: true,
          color: '203864',
          fontFace: PPT_FONTS.heading
        });

        // Prepare detail values
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

        // Render detail lines with bold labels and cleaner colors
        let detailY = y + 0.65;
        const detailLineHeight = 0.38;

        const addDetailLine = (label: string, value: string) => {
          slide.addText(
            [
              {
                text: `${label}: `,
                options: {
                  bold: true,
                  color: '666666',
                  fontFace: PPT_FONTS.body
                }
              },
              {
                text: value,
                options: {
                  bold: false,
                  color: '222222',
                  fontFace: PPT_FONTS.body
                }
              }
            ],
            {
              x: contentX,
              y: detailY,
              w: contentWidth,
              h: detailLineHeight,
              fontSize: 13,
              fontFace: PPT_FONTS.body,
              valign: 'top'
            }
          );

          detailY += detailLineHeight + 0.03;
        };

        addDetailLine('Phone Number', phoneText);
        addDetailLine('Home Address', homeAddressText);
        addDetailLine('Ministry', ministryText);
        addDetailLine('Bacenta', bacentaText);
        addDetailLine('Birthday', birthdayText);
        addDetailLine('Born Again Status', member.bornAgainStatus ? 'Yes' : 'No');
        addDetailLine('Prays in tongues', tonguesText);
        addDetailLine('Water baptized', baptizedText);

        indexOnSlide += 1;
      });
    };

    addSectionSlides('Green Bacentas', greenBacentas, '00703C');
    addSectionSlides('Red Bacentas', redBacentas, '9E1B32');
    addSectionSlides('Assistants', assistants, '2F5597');
    addSectionSlides('Members', membersOnly, '595959');

    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = reportName.replace(/\s+/g, '-');
    const filename = `${safeName}-Hierarchy-Attendance-${timestamp}.pptx`;

    const buffer = await pptx.write('arraybuffer');

    const result = await saveFileToDirectory(
      options.directory || null,
      filename,
      buffer,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
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

