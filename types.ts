
export type MemberRole = 'Member' | 'Fellowship Leader' | 'Bacenta Leader';

export interface Member {
  id: string;
  firstName: string;
  lastName?: string; // Made optional - Last name is no longer required
  phoneNumber: string;
  buildingAddress: string;
  roomNumber?: string; // Room number for members
  profilePicture?: string; // Base64 encoded image string
  bornAgainStatus: boolean;
  /** If true, this member is temporarily frozen (excluded from counts/absentees) */
  frozen?: boolean;
  /** If true, this member originated from an Outreach flow (born again from outreach) */
  outreachOrigin?: boolean;
  bacentaId: string; // Renamed from congregationGroup, stores Bacenta.id, empty if unassigned
  /**
   * Additional bacentas this leader is linked to. The member officially belongs
   * to `bacentaId` only (for counting), but can be linked to others for weekly
   * structure display. Leader should not be duplicated in those linked bacentas' member lists.
   */
  linkedBacentaIds?: string[]; // Secondary/linked bacentas (leaders only)
  bacentaLeaderId?: string; // For Fellowship Leaders: ID of the Bacenta Leader they report to
  role: MemberRole; // Role assignment: Member (default), Fellowship Leader, or Bacenta Leader
  birthday?: string; // Optional birthday field in YYYY-MM-DD format
  createdDate: string; // ISO string
  lastUpdated: string; // ISO string
}

export interface NewBeliever {
  id: string;
  name: string; // Required field
  surname: string;
  contact: string;
  dateOfBirth: string; // ISO string, YYYY-MM-DD
  residence: string;
  studies: string;
  campus: string;
  occupation: string;
  year: string;
  isFirstTime: boolean; // First Time? boolean field
  ministry: string; // Ministry dropdown selection
  joinedDate: string; // ISO string, YYYY-MM-DD - when they joined
  createdDate: string; // ISO string
  lastUpdated: string; // ISO string
}

export type AttendanceStatus = 'Present' | 'Absent';

export interface AttendanceRecord {
  id: string; // memberId_date (YYYY-MM-DD) or newBelieverId_date (YYYY-MM-DD)
  memberId?: string; // For regular members
  newBelieverId?: string; // For new believers
  date: string; // Sunday date as YYYY-MM-DD
  status: AttendanceStatus;
}

// Prayer tracking types
export type PrayerStatus = 'Prayed' | 'Missed';

export interface PrayerRecord {
  id: string; // memberId_date (YYYY-MM-DD)
  memberId: string;
  date: string; // Any date (Tue–Sun) as YYYY-MM-DD
  status: PrayerStatus;
}

export type ConfirmationStatus = 'Confirmed' | 'Not Confirmed';

export interface SundayConfirmation {
  id: string; // memberId_date (YYYY-MM-DD) or guestId_date (YYYY-MM-DD)
  memberId?: string; // For regular members
  guestId?: string; // For guests/visitors
  date: string; // Sunday date as YYYY-MM-DD
  status: ConfirmationStatus;
  confirmationTimestamp: string; // ISO string when confirmation was made
  confirmedBy?: string; // User ID who made the confirmation
  removedBy?: string; // User ID who removed the confirmation (if applicable)
  removedAt?: string; // ISO string when confirmation was removed
}

export interface Guest {
  id: string; // Unique guest ID
  firstName: string;
  lastName?: string;
  bacentaId: string; // Required bacenta assignment
  roomNumber?: string; // Room number for guests
  phoneNumber?: string;
  notes?: string; // Additional notes about the guest
  createdDate: string; // ISO string
  lastUpdated: string; // ISO string
  createdBy: string; // User ID who added the guest
}

export interface Bacenta { // Renamed from CongregationGroup
  id: string;
  name: string;
}


export interface OutreachBacenta {
  id: string;
  name: string;
}

export interface OutreachMember {
  id: string;
  name: string; // Full name
  phoneNumbers?: string[];
  roomNumber?: string;
  bacentaId: string; // OutreachBacenta.id
  comingStatus: boolean; // Coming (Yes/No)
  notComingReason?: string; // Optional reason when not coming
  outreachDate: string; // YYYY-MM-DD
  createdDate: string; // ISO
  lastUpdated: string; // ISO
  convertedMemberId?: string; // If converted to permanent member
  guestId?: string; // Linked guest (for confirmations/migration)
  /** If set, links to the created 'Born Again' member record */
  bornAgainMemberId?: string;
}

export interface TabOption {
  id: string;
  name: string;
  data?: any; // For storing additional context like bacenta filters, search terms, etc.
}

export enum TabKeys {
  DASHBOARD = 'dashboard',
  ALL_CONGREGATIONS = 'all_members', // Kept ID for now, name will change in FIXED_TABS
  ALL_BACENTAS = 'all_bacentas',
  ATTENDANCE_ANALYTICS = 'attendance_analytics',
  WEEKLY_ATTENDANCE = 'weekly_attendance',
  SUNDAY_CONFIRMATIONS = 'sunday_confirmations',
  NEW_BELIEVERS = 'new_believers',
  OUTREACH = 'outreach',
  PRAYER = 'prayer',
  PRAYER_MEMBER_DETAILS = 'prayer_member_details',
  BIRTHDAYS = 'birthdays',
  PROFILE_SETTINGS = 'profile_settings',
  MY_DELETION_REQUESTS = 'my_deletion_requests',
  ADMIN_DELETION_REQUESTS = 'admin_deletion_requests',
  COPY_MEMBERS = 'copy_members',
  COPY_ABSENTEES = 'copy_absentees',
  BACENTA_OUTREACH = 'bacenta_outreach',
}

export interface NavigationHistoryItem {
  tabId: string;
  timestamp: number;
  data?: any; // For storing additional context like bacenta filters
}

export interface NavigationHistoryItem {
  tabId: string;
  timestamp: number;
  data?: any; // For storing additional context like bacenta filters
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  allowEditPreviousSundays: boolean;
  /** Optional custom app display name shown in header */
  appDisplayName?: string;
  /** Optional selected ministry name; can be used as default app name */
  ministryName?: string;
}

export interface NotificationPreferences {
  birthdayNotifications: {
    enabled: boolean;
    daysBeforeNotification: number[]; // e.g., [7, 3, 1] for 7, 3, and 1 day notifications
    emailTime: string; // Time in HH:MM format (24-hour), e.g., "09:00"
  };
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  churchId: string;
  churchName?: string;
  role: 'admin' | 'leader' | 'member';
  preferences?: UserPreferences;
  notificationPreferences?: NotificationPreferences;
  createdAt: string;
  lastLoginAt: string;
  lastUpdated?: string;
  isActive: boolean;
  isInvitedAdminLeader?: boolean; // True if this user became a leader through an admin invite
  invitedByAdminId?: string; // UID of the admin who invited this user to become a leader
}

export interface Church {
  id: string;
  name: string;
  address?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
  };
  settings?: {
    timezone?: string;
    defaultMinistries?: string[];
    notificationSettings?: {
  birthdayNotificationsEnabled: boolean;
  // Days before birthday to notify (e.g., [7,5,3,2,1,0])
  defaultNotificationDays: number[];
  // Local time of day for sending notifications, 'HH:mm' (e.g., '00:00' for midnight)
  defaultNotificationTime: string;
    };
  };
  createdAt: string;
  lastUpdated: string;
}

// Birthday Notification System Types
export interface BirthdayNotification {
  id: string;
  memberId: string;
  memberName: string;
  memberBirthday: string; // YYYY-MM-DD format
  bacentaId: string;
  bacentaName: string;
  notificationDate: string; // YYYY-MM-DD format - when notification was sent
  daysBeforeBirthday: number; // e.g., 7, 5, 3, 2, 1, or 0 (on the day)
  sentTo: string[]; // Array of user IDs who received the notification
  status: 'sent' | 'failed' | 'pending';
  emailDetails?: {
    subject: string;
    sentAt: string; // ISO timestamp
    failureReason?: string;
  };
  createdAt: string; // ISO timestamp
  lastUpdated: string; // ISO timestamp
}

export interface NotificationRecipient {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'leader' | 'member';
  relationshipToMember: 'admin' | 'bacenta_leader' | 'fellowship_leader';
  bacentaId?: string; // For leaders, the bacenta they oversee
}

export interface BirthdayEmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
  memberData: {
    firstName: string;
    lastName?: string;
    birthday: string;
    age: number;
    profilePicture?: string;
    phoneNumber: string;
    buildingAddress: string;
    roomNumber?: string;
    role: MemberRole;
    bornAgainStatus: boolean;
    bacentaName: string;
  };
  recipientData: {
    firstName: string;
    lastName: string;
    role: string;
  };
  daysUntilBirthday: number;
}

export interface AdminInvite {
  id: string;
  invitedUserEmail: string;
  invitedUserId: string;
  invitedUserName: string;
  invitedUserChurchId: string; // Church ID of the invited user
  invitedUserChurchName?: string; // Church name of the invited user
  createdBy: string; // Admin UID who created the invite
  createdByName: string; // Admin display name
  churchId: string; // Church ID of the admin who created the invite
  targetRole: 'leader'; // Role the invitee will get
  status: 'pending' | 'accepted' | 'rejected' | 'revoked';
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
  revokedAt?: string; // When leader access was revoked
  accessChurchId?: string; // Church ID that the leader should have access to
}

// Member Deletion Request System Types
export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface MemberDeletionRequest {
  id: string; // Auto-generated document ID
  memberId: string; // ID of member to be deleted
  memberName: string; // Cached member name for display purposes
  requestedBy: string; // ID of leader who requested deletion
  requestedByName: string; // Cached requester name for display
  requestedAt: string; // ISO timestamp of request
  status: DeletionRequestStatus;
  reason?: string; // Optional reason for deletion request
  reviewedBy?: string; // ID of admin who approved/rejected (if applicable)
  reviewedByName?: string; // Cached reviewer name for display
  reviewedAt?: string; // ISO timestamp of admin decision (if applicable)
  adminNotes?: string; // Optional notes from admin during review
  churchId: string; // Church context for the request
  expiresAt?: string; // Optional expiration timestamp (auto-reject after 7 days)
}

// Admin Notification System Types
export type NotificationActivityType =
  | 'member_added'
  | 'member_updated'
  | 'member_deleted'
  | 'attendance_confirmed'
  | 'attendance_updated'
  | 'new_believer_added'
  | 'new_believer_updated'
  | 'guest_added'
  | 'bacenta_assignment_changed'
  | 'member_freeze_toggled'
  | 'member_converted'
  | 'birthday_reminder';

export interface AdminNotification {
  id: string; // Auto-generated document ID
  leaderId: string; // ID of leader who performed the action
  leaderName: string; // Cached leader name for display
  adminId: string; // ID of admin who should receive this notification
  activityType: NotificationActivityType;
  timestamp: string; // ISO timestamp of the activity
  isRead: boolean; // Whether the admin has read this notification
  churchId: string; // Church context for the notification

  // Activity-specific details
  details: {
    memberName?: string; // For member-related activities
    memberRole?: string; // For member role changes
    bacentaName?: string; // For bacenta-related activities
    attendanceDate?: string; // For attendance activities
    newBelieverName?: string; // For new believer activities
    guestName?: string; // For guest activities
    description: string; // Human-readable description of the activity
  };

  // Optional metadata
  metadata?: {
    previousValue?: string; // For update activities
    newValue?: string; // For update activities
    attendanceCount?: number; // For attendance activities
    [key: string]: any; // Flexible metadata
  };
}
