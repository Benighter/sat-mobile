import { EmailNotificationService } from './emailNotificationService';
import { getPrimaryEmailApiUrl, getPrimaryEmailApiKey } from '../constants';
import { Member, NotificationRecipient, Bacenta } from '../types';

/**
 * Client for calling Cloud Function to send emails.
 */
export const emailServiceClient = {
  /**
   * Sends a birthday email via callable Cloud Function to a single recipient.
   */
  async sendBirthdayEmail(to: string, subject: string, html: string, text?: string) {
    // Prefer external API if provided
    const apiUrl = getPrimaryEmailApiUrl();
    if (apiUrl) {
      try {
        const apiKey = getPrimaryEmailApiKey();
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({ to, subject, html, text })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || `HTTP ${response.status}`);
        }
        return { success: true, messageId: data?.id || data?.messageId || null };
      } catch (err) {
        // Fall back to callable on failure
        console.warn('Primary email API failed, falling back to callable:', (err as any)?.message || err);
      }
    }

    // Fallback: Firebase callable
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const appFunctions = getFunctions();
    const fn = httpsCallable(appFunctions, 'sendBirthdayEmail');
    const res: any = await fn({ to, subject, html, text });
    return res?.data || { success: false };
  },

  /**
   * Generate and send a test birthday email to the current user (admin/leader) only.
   * Requires: logged in user with an email.
   */
  async sendTestBirthdayEmail(currentUser: { uid: string; email: string; displayName?: string; role?: string },
    exampleMember?: Partial<Member>) {
    if (!currentUser?.email) throw new Error('Current user has no email');

    // Minimal demo member to render template
    const member: Member = {
      id: exampleMember?.id || 'demo-member',
      firstName: exampleMember?.firstName || 'John',
      lastName: exampleMember?.lastName || 'Doe',
      phoneNumber: exampleMember?.phoneNumber || '000-000-0000',
      buildingAddress: exampleMember?.buildingAddress || 'Main Dorms',
      roomNumber: exampleMember?.roomNumber || 'A101',
      profilePicture: exampleMember?.profilePicture,
      bornAgainStatus: exampleMember?.bornAgainStatus ?? true,
      bacentaId: exampleMember?.bacentaId || 'demo-bacenta',
      role: exampleMember?.role || 'Member',
      birthday: exampleMember?.birthday || new Date().toISOString().slice(0, 10),
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    const recipient: NotificationRecipient = {
      userId: currentUser.uid,
      email: currentUser.email,
      firstName: (currentUser.displayName || 'Admin').split(' ')[0],
      lastName: (currentUser.displayName || '').split(' ').slice(1).join(' '),
      role: (currentUser.role as any) || 'admin',
      relationshipToMember: 'admin'
    };

    const template = EmailNotificationService
      .getInstance()
      .generateBirthdayEmailTemplate(member, recipient, 'Demo Bacenta', 7);

    return this.sendBirthdayEmail(currentUser.email, template.subject, template.htmlContent, template.textContent);
  },

  /**
   * Compose and send an Upcoming Birthdays digest email to the current user
   */
  async sendUpcomingBirthdaysDigest(
    currentUser: { uid: string; email: string; displayName?: string },
    members: Member[],
    bacentas?: Bacenta[]
  ) {
    if (!currentUser?.email) throw new Error('Current user has no email');
    // Generate digest via service (ensures consistent formatting)
    const svc = EmailNotificationService.getInstance();
    const digest = svc.generateUpcomingBirthdaysDigest(members, bacentas);
    return this.sendBirthdayEmail(currentUser.email, digest.subject, digest.htmlContent, digest.textContent);
  }
};
