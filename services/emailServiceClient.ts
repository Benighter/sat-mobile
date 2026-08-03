import { EmailNotificationService } from './emailNotificationService';
import { getPrimaryEmailApiUrl } from '../constants';
import { Member, NotificationRecipient, Bacenta } from '../types';
import { invokeBackendFunction } from './backendFunctionService';
import { getSupabaseClient } from './supabase/client';

const FIREBASE_FUNCTIONS_REGION = 'us-central1';
const FIREBASE_PROJECT_ID = 'sat-mobile-de6f1';

/**
 * Client for calling Cloud Function to send emails.
 */
export const emailServiceClient = {
  /**
   * Formats and opens a native email client (mailto:) deep link.
   */
  sendViaMailto(to: string, subject: string, text: string) {
    // Strip HTML tags if only HTML is available
    const plainText = text.replace(/<[^>]*>/g, '');
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`;
    if (typeof window !== 'undefined') {
      window.location.href = mailtoUrl;
    }
  },

  /**
   * Sends a birthday email via callable Cloud Function or Brevo/mailto fallback to a single recipient.
   */
  async sendBirthdayEmail(to: string, subject: string, html: string, text?: string): Promise<{ success: boolean; messageId?: string; error?: string; debugLogs?: string[] }> {
    const debugLogs: string[] = [];
    const log = (msg: string) => {
      console.log(`[EmailServiceClient] ${msg}`);
      debugLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    };

    log(`Initializing email sending process to: ${to}`);

    // Check configured delivery method (Default to 'brevo' as the global default)
    const deliveryMethod = typeof window !== 'undefined'
      ? window.localStorage.getItem('sat-mobile-email-delivery-method') || 'brevo'
      : 'brevo';

    log(`Selected delivery method: ${deliveryMethod}`);

    // Resolve dynamic sender details for the backend Cloud Function
    let currentUserEmail = '';
    let currentDisplayName = '';
    if (typeof window !== 'undefined') {
      try {
        const { auth } = await import('../firebase.config');
        if (auth.currentUser) {
          currentUserEmail = auth.currentUser.email || '';
          currentDisplayName = auth.currentUser.displayName || '';
        }
      } catch (e) {
        log(`Failed to resolve current authenticated user: ${e}`);
      }
    }

    const localSenderEmail = typeof window !== 'undefined' ? window.localStorage.getItem('sat-mobile-brevo-sender-email') : null;
    const senderEmail = (localSenderEmail && localSenderEmail !== 'notifications@sat-mobile.app')
      ? localSenderEmail
      : (currentUserEmail || 'notifications@sat-mobile.app');

    const localSenderName = typeof window !== 'undefined' ? window.localStorage.getItem('sat-mobile-brevo-sender-name') : null;
    const senderName = (localSenderName && localSenderName !== 'SAT Mobile')
      ? localSenderName
      : (currentDisplayName || 'SAT Mobile');

    const fromField = `${senderName} <${senderEmail}>`;

    if (deliveryMethod === 'brevo' && import.meta.env.VITE_DATA_BACKEND !== 'firebase') {
      try {
        log('Routing transactional email through the authenticated Supabase Edge Function...');
        const { data, error } = await getSupabaseClient().functions.invoke('sat-transactional-email', {
          body: { to, subject, html, text, kind: 'birthday' },
        });
        if (error) throw error;
        if (data?.ok === true) {
          return { success: true, messageId: data.requestId || undefined, debugLogs };
        }
        throw new Error(data?.code || 'Supabase email function returned an unknown response');
      } catch (edgeError) {
        // Firebase remains an explicit rollback until the Edge Function has a
        // verified provider secret and the native-auth cutover is released.
        log(`Supabase email path unavailable; retaining authenticated rollback: ${(edgeError as any)?.message || edgeError}`);
      }
    }

    if (deliveryMethod === 'mailto') {
      log('Preparing native mailto draft client deep link...');
      this.sendViaMailto(to, subject, text || html);
      log('Native mail client deep-link triggered.');
      return { success: true, messageId: 'mailto-client-delivery', debugLogs };
    }

    // Prefer external API if provided
    const apiUrl = getPrimaryEmailApiUrl();
    if (apiUrl) {
      try {
        log(`Routing through primary email API URL: ${apiUrl}...`);
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ to, subject, html, text, from: fromField })
        });
        const data = await response.json().catch(() => ({}));
        log(`Primary API Response: HTTP ${response.status} - ${JSON.stringify(data)}`);
        if (!response.ok) {
          throw new Error(data?.error || `HTTP ${response.status}`);
        }
        log('Primary API delivery completed!');
        return { success: true, messageId: data?.id || data?.messageId || undefined, debugLogs };
      } catch (err) {
        log(`Primary API failed: ${(err as any)?.message || err}`);
      }
    }

    // Prefer Firebase callable in production
    try {
      log('Routing through Firebase Cloud Function Callable...');
      log('Calling cloud function "sendBirthdayEmail"...');
      const result: any = await invokeBackendFunction('sendBirthdayEmail', { to, subject, html, text, from: fromField });
      log(`Cloud function response: ${JSON.stringify(result)}`);
      if (result?.success) {
        return { success: true, messageId: result?.messageId || undefined, debugLogs };
      }
      log(`Cloud function returned failure: ${result?.error || 'Unknown'}`);
    } catch (callableErr) {
      log(`Firebase callable failed: ${callableErr}`);
    }

    try {
      log('Routing through authenticated Firebase HTTP fallback...');
      const [{ getAuth }] = await Promise.all([
        import('firebase/auth')
      ]);
      const idToken = await getAuth().currentUser?.getIdToken();
      log(`Resolved Firebase ID Token: ${idToken ? 'Present' : 'Absent'}`);
      const httpUrl = `https://${FIREBASE_FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/sendBirthdayEmailHttp`;
      log(`Sending HTTP POST to: ${httpUrl}`);
      const response = await fetch(httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ to, subject, html, text, from: fromField })
      });
      const data = await response.json().catch(() => ({}));
      log(`HTTP Fallback Response: HTTP ${response.status} - ${JSON.stringify(data)}`);
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }
      if (data?.success) {
        return { success: true, messageId: data?.messageId || undefined, debugLogs };
      }
      return { success: false, error: data?.error || 'Unknown email send failure', debugLogs };
    } catch (httpErr) {
      log(`HTTP fallback failed: ${httpErr}`);
      return { success: false, error: `HTTP fallback failed: ${(httpErr as any)?.message || httpErr}`, debugLogs };
    }
  },

  /**
   * Generate and send a test birthday email to the current user (admin/leader) only.
   * Requires: logged in user with an email.
   */
  async sendTestBirthdayEmail(
    currentUser: { uid: string; email: string; displayName?: string; role?: string },
    exampleMember?: Partial<Member>
  ) {
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
  },

};
