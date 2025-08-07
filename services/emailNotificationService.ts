import { BirthdayEmailTemplate, NotificationRecipient, Member } from '../types';
import { calculateAge, formatBirthdayDisplay } from '../utils/birthdayUtils';

/**
 * Email notification service for birthday alerts
 * Handles email template generation and delivery
 */
export class EmailNotificationService {
  private static instance: EmailNotificationService;
  
  private constructor() {}
  
  public static getInstance(): EmailNotificationService {
    if (!EmailNotificationService.instance) {
      EmailNotificationService.instance = new EmailNotificationService();
    }
    return EmailNotificationService.instance;
  }

  /**
   * Generate email template for birthday notification
   */
  public generateBirthdayEmailTemplate(
    member: Member,
    recipient: NotificationRecipient,
    bacentaName: string,
    daysUntilBirthday: number
  ): BirthdayEmailTemplate {
    const memberAge = calculateAge(member.birthday!);
    const birthdayDisplay = formatBirthdayDisplay(member.birthday!);
    const memberFullName = `${member.firstName} ${member.lastName || ''}`.trim();
    
    // Generate subject line
    const subject = this.generateSubjectLine(memberFullName, daysUntilBirthday);
    
    // Generate email content
    const htmlContent = this.generateHtmlContent(member, recipient, bacentaName, daysUntilBirthday, memberAge);
    const textContent = this.generateTextContent(member, recipient, bacentaName, daysUntilBirthday, memberAge);

    return {
      subject,
      htmlContent,
      textContent,
      memberData: {
        firstName: member.firstName,
        lastName: member.lastName,
        birthday: member.birthday!,
        age: memberAge,
        profilePicture: member.profilePicture,
        phoneNumber: member.phoneNumber,
        buildingAddress: member.buildingAddress,
        roomNumber: member.roomNumber,
        role: member.role,
        bornAgainStatus: member.bornAgainStatus,
        bacentaName
      },
      recipientData: {
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        role: recipient.role
      },
      daysUntilBirthday
    };
  }

  /**
   * Generate subject line for birthday notification
   */
  private generateSubjectLine(memberName: string, daysUntilBirthday: number): string {
    if (daysUntilBirthday === 0) {
      return `🎉 Birthday Today - ${memberName}`;
    } else if (daysUntilBirthday === 1) {
      return `🎂 Birthday Tomorrow - ${memberName} (1 day)`;
    } else {
      return `🎈 Upcoming Birthday - ${memberName} (${daysUntilBirthday} days)`;
    }
  }

  /**
   * Generate HTML email content
   */
  private generateHtmlContent(
    member: Member,
    recipient: NotificationRecipient,
    bacentaName: string,
    daysUntilBirthday: number,
    memberAge: number
  ): string {
    const memberFullName = `${member.firstName} ${member.lastName || ''}`.trim();
    const birthdayDisplay = formatBirthdayDisplay(member.birthday!);
    const profileImageHtml = member.profilePicture 
      ? `<img src="${member.profilePicture}" alt="${memberFullName}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">`
      : `<div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; margin-bottom: 15px;">${member.firstName.charAt(0)}${(member.lastName || '').charAt(0)}</div>`;

    const daysText = daysUntilBirthday === 0 ? 'today' : 
                     daysUntilBirthday === 1 ? 'tomorrow' : 
                     `in ${daysUntilBirthday} days`;

    const roleDisplay = member.role === 'Member' ? 'Member' :
                       member.role === 'Fellowship Leader' ? 'Fellowship Leader' :
                       member.role === 'Bacenta Leader' ? 'Bacenta Leader' : member.role;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Birthday Notification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🎉 Birthday Notification</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Church Member Management System</p>
    </div>
    
    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
        <div style="text-align: center; margin-bottom: 25px;">
            ${profileImageHtml}
            <h2 style="margin: 0; color: #2c3e50; font-size: 24px;">${memberFullName}</h2>
            <p style="margin: 5px 0; color: #7f8c8d; font-size: 16px;">has a birthday ${daysText}!</p>
        </div>
        
        <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Member Details</h3>
            
            <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ecf0f1;">
                    <strong>Birthday:</strong>
                    <span>${birthdayDisplay}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ecf0f1;">
                    <strong>Age Turning:</strong>
                    <span>${memberAge + 1} years old</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ecf0f1;">
                    <strong>Bacenta:</strong>
                    <span>${bacentaName}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ecf0f1;">
                    <strong>Role:</strong>
                    <span>${roleDisplay}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ecf0f1;">
                    <strong>Phone:</strong>
                    <span>${member.phoneNumber}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ecf0f1;">
                    <strong>Address:</strong>
                    <span>${member.buildingAddress}${member.roomNumber ? `, Room ${member.roomNumber}` : ''}</span>
                </div>
                ${member.bornAgainStatus ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <strong>Born Again:</strong>
                    <span style="color: #27ae60;">✓ Yes</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div style="background: #e8f5e8; border: 1px solid #c3e6c3; border-radius: 8px; padding: 20px; text-align: center;">
            <p style="margin: 0; color: #2d5a2d; font-size: 16px;">
                <strong>Dear ${recipient.firstName},</strong><br>
                As a ${recipient.role} in our church family, we wanted to make sure you're aware of this upcoming birthday 
                so you can reach out and celebrate with ${member.firstName}!
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="margin: 0; color: #7f8c8d; font-size: 14px;">
                This notification was sent automatically by the Church Management System.<br>
                You received this because you have oversight responsibilities for members in the ${bacentaName} bacenta.
            </p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email content
   */
  private generateTextContent(
    member: Member,
    recipient: NotificationRecipient,
    bacentaName: string,
    daysUntilBirthday: number,
    memberAge: number
  ): string {
    const memberFullName = `${member.firstName} ${member.lastName || ''}`.trim();
    const birthdayDisplay = formatBirthdayDisplay(member.birthday!);
    const daysText = daysUntilBirthday === 0 ? 'today' : 
                     daysUntilBirthday === 1 ? 'tomorrow' : 
                     `in ${daysUntilBirthday} days`;

    return `
BIRTHDAY NOTIFICATION - Church Member Management System

Dear ${recipient.firstName},

${memberFullName} has a birthday ${daysText}!

MEMBER DETAILS:
- Name: ${memberFullName}
- Birthday: ${birthdayDisplay}
- Age Turning: ${memberAge + 1} years old
- Bacenta: ${bacentaName}
- Role: ${member.role}
- Phone: ${member.phoneNumber}
- Address: ${member.buildingAddress}${member.roomNumber ? `, Room ${member.roomNumber}` : ''}
${member.bornAgainStatus ? '- Born Again: Yes' : ''}

As a ${recipient.role} in our church family, we wanted to make sure you're aware of this upcoming birthday so you can reach out and celebrate with ${member.firstName}!

---
This notification was sent automatically by the Church Management System.
You received this because you have oversight responsibilities for members in the ${bacentaName} bacenta.
`.trim();
  }

  /**
   * Send birthday notification email (placeholder - implement with your email service)
   */
  public async sendBirthdayNotification(
    template: BirthdayEmailTemplate,
    recipient: NotificationRecipient
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      // TODO: Implement actual email sending logic
      // This could use services like SendGrid, AWS SES, Firebase Functions with Nodemailer, etc.

      console.log(`Sending birthday notification to ${recipient.email}`);
      console.log(`Subject: ${template.subject}`);

      // Example implementation with SendGrid (commented out):
      /*
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: recipient.email,
        from: 'noreply@yourchurch.com',
        subject: template.subject,
        text: template.textContent,
        html: template.htmlContent,
      };

      const response = await sgMail.send(msg);
      return { success: true, messageId: response[0].headers['x-message-id'] };
      */

      // Simulate email sending for now
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };

    } catch (error: any) {
      console.error('Failed to send birthday notification:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred while sending email'
      };
    }
  }

  /**
   * Send multiple birthday notifications with error handling
   */
  public async sendBulkBirthdayNotifications(
    templates: Array<{ template: BirthdayEmailTemplate; recipient: NotificationRecipient }>
  ): Promise<Array<{ recipient: NotificationRecipient; success: boolean; error?: string; messageId?: string }>> {
    const results = [];

    for (const { template, recipient } of templates) {
      const result = await this.sendBirthdayNotification(template, recipient);
      results.push({
        recipient,
        success: result.success,
        error: result.error,
        messageId: result.messageId
      });

      // Add small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}
