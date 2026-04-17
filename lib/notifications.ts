// Email and SMS utility functions for notifications
// Now supports both environment variables and database settings

import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Get settings from database or environment variables
async function getSettings() {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/settings`);
    const data = await res.json();
    if (data.success) {
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
  }
  return null;
}

// Initialize Twilio client (from settings or env)
async function getTwilioClient() {
  const settings = await getSettings();

  if (settings?.smsEnabled && settings.twilioAccountSid && settings.twilioAuthToken) {
    return twilio(settings.twilioAccountSid, settings.twilioAuthToken);
  }

  // Fallback to environment variables
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  return null;
}

// Initialize SMTP transporter (from settings or env)
async function getEmailTransporter() {
  const settings = await getSettings();

  if (settings?.emailEnabled && settings.smtpHost && settings.smtpUser && settings.smtpPassword) {
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
    });
  }

  // Fallback to environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return null;
}

// SMS Functions
export async function sendSMS(to: string, message: string): Promise<boolean> {
  const twilioClient = await getTwilioClient();
  const settings = await getSettings();

  if (!twilioClient) {
    console.warn('Twilio not configured. SMS not sent.');
    return false;
  }

  const phoneNumber = settings?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER;
  if (!phoneNumber) {
    console.warn('TWILIO_PHONE_NUMBER not set. SMS not sent.');
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: phoneNumber,
      to: to,
    });
    console.log(`SMS sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

// Email Functions
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  const emailTransporter = await getEmailTransporter();
  const settings = await getSettings();

  if (!emailTransporter) {
    console.warn('Email transporter not configured. Email not sent.');
    return false;
  }

  const fromEmail = settings?.smtpFrom || process.env.SMTP_FROM;
  if (!fromEmail) {
    console.warn('SMTP_FROM not set. Email not sent.');
    return false;
  }

  try {
    await emailTransporter.sendMail({
      from: fromEmail,
      to: to,
      subject: subject,
      text: text || '',
      html: html,
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Appointment Reminder Templates
export function getAppointmentReminderSMS(
  customerName: string,
  staffName: string,
  date: string,
  time: string,
  salonName: string = 'Our Salon'
): string {
  return `Hi ${customerName}! Reminder: You have an appointment with ${staffName} at ${salonName} on ${date} at ${time}. See you soon!`;
}

export function getAppointmentReminderEmail(
  customerName: string,
  staffName: string,
  date: string,
  time: string,
  services: string[],
  salonName: string = 'Our Salon',
  salonPhone?: string,
  salonAddress?: string
): { subject: string; html: string; text: string } {
  const servicesList = services.join(', ');

  const subject = `Appointment Reminder - ${date}`;

  const text = `Hi ${customerName},\n\nThis is a friendly reminder about your upcoming appointment:\n\nDate: ${date}\nTime: ${time}\nStaff: ${staffName}\nServices: ${servicesList}\n\nWe look forward to seeing you!\n\nBest regards,\n${salonName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .appointment-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; width: 120px; color: #6b7280; }
        .detail-value { color: #111827; }
        .services { background: #eff6ff; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Appointment Reminder</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">We're looking forward to seeing you!</p>
        </div>
        <div class="content">
          <p style="font-size: 16px;">Hi <strong>${customerName}</strong>,</p>
          <p>This is a friendly reminder about your upcoming appointment at <strong>${salonName}</strong>.</p>
          
          <div class="appointment-card">
            <h2 style="margin-top: 0; color: #1e3a8a;">Appointment Details</h2>
            <div class="detail-row">
              <div class="detail-label">📅 Date:</div>
              <div class="detail-value">${date}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">🕐 Time:</div>
              <div class="detail-value">${time}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">💇 Staff:</div>
              <div class="detail-value">${staffName}</div>
            </div>
            <div class="services">
              <strong>Services:</strong><br/>
              ${servicesList}
            </div>
          </div>
          
          ${salonPhone ? `<p><strong>Contact:</strong> ${salonPhone}</p>` : ''}
          ${salonAddress ? `<p><strong>Location:</strong> ${salonAddress}</p>` : ''}
          
          <p style="margin-top: 30px;">If you need to reschedule or cancel, please contact us as soon as possible.</p>
          <p>We look forward to seeing you!</p>
        </div>
        <div class="footer">
          <p>Best regards,<br/><strong>${salonName}</strong></p>
          <p style="font-size: 12px; color: #9ca3af;">This is an automated reminder. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html, text };
}

// Verify configuration
export async function isEmailConfigured(): Promise<boolean> {
  const settings = await getSettings();

  // Check database settings first
  if (settings?.emailEnabled && settings.smtpHost && settings.smtpUser && settings.smtpPassword) {
    return true;
  }

  // Fallback to environment variables
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

export async function isSMSConfigured(): Promise<boolean> {
  const settings = await getSettings();

  // Check database settings first
  if (settings?.smsEnabled && settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioPhoneNumber) {
    return true;
  }

  // Fallback to environment variables
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
