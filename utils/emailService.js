// backend/utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Email templates
const emailTemplates = {
  emailVerification: (name, verificationLink) => ({
    subject: 'Verify Your Email - Thrift Store',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Email Verification</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for registering with Thrift Store. Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationLink}" class="button">Verify Email Address</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationLink}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Thrift Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordReset: (name, resetLink) => ({
    subject: 'Password Reset Request - Thrift Store',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>We received a request to reset your password for your Thrift Store account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #f5576c;">${resetLink}</p>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Your password won't change until you create a new one</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Thrift Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordChanged: (name) => ({
    subject: 'Password Changed Successfully - Thrift Store',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Changed</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>This is a confirmation that your password has been successfully changed.</p>
            <div class="alert">
              <strong>ℹ️ If you didn't make this change:</strong>
              <p>Please contact our support team immediately as your account may be compromised.</p>
            </div>
            <p>Changed on: ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Thrift Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  accountLocked: (name, lockDuration) => ({
    subject: 'Account Locked - Security Alert',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Account Locked</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <div class="warning">
              <strong>⚠️ Security Alert:</strong>
              <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
            </div>
            <p><strong>Lock Duration:</strong> ${lockDuration} minutes</p>
            <p><strong>What to do:</strong></p>
            <ul>
              <li>Wait for the lock period to expire</li>
              <li>If this wasn't you, change your password immediately after the lock expires</li>
              <li>Enable Two-Factor Authentication for additional security</li>
            </ul>
            <p>Your account will automatically unlock after the specified duration.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Thrift Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  twoFactorEnabled: (name) => ({
    subject: 'Two-Factor Authentication Enabled - Thrift Store',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 2FA Enabled</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <div class="success">
              <strong>✅ Success!</strong>
              <p>Two-Factor Authentication has been successfully enabled on your account.</p>
            </div>
            <p>Your account is now more secure. You'll need to enter a verification code from your authenticator app each time you log in.</p>
            <p><strong>Important:</strong> Make sure to save your backup codes in a safe place. You'll need them if you lose access to your authenticator app.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Thrift Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordExpiryWarning: (name, daysRemaining) => ({
    subject: `Password Expiry Warning - ${daysRemaining} Days Remaining`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Password Expiry Warning</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <div class="warning">
              <strong>⚠️ Your password will expire soon!</strong>
              <p>Your password will expire in <strong>${daysRemaining} days</strong>.</p>
            </div>
            <p>For your security, we require you to change your password every 90 days.</p>
            <p>Please change your password before it expires to avoid being locked out of your account.</p>
            <a href="${process.env.FRONTEND_URL}/change-password" class="button">Change Password Now</a>
            <p><strong>Why do we require password changes?</strong></p>
            <ul>
              <li>Protect your account from unauthorized access</li>
              <li>Reduce the risk of compromised credentials</li>
              <li>Maintain the highest security standards</li>
            </ul>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Thrift Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  passwordExpired: (name) => ({
    subject: 'Password Expired - Action Required',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Expired</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <div class="alert">
              <strong>⚠️ Your password has expired!</strong>
              <p>Your password is more than 90 days old and must be changed immediately.</p>
            </div>
            <p>You will be required to change your password the next time you log in.</p>
            <a href="${process.env.FRONTEND_URL}/login" class="button">Log In to Change Password</a>
            <p>If you have any questions or need assistance, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Thrift Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Send email function
export const sendEmail = async (to, templateName, templateData) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates[templateName];

    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    const emailContent = template(...Object.values(templateData));

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Thrift Store" <${process.env.EMAIL_USER}>`,
      to,
      subject: emailContent.subject,
      html: emailContent.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// Specific email sending functions
export const sendVerificationEmail = async (email, name, token) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  return sendEmail(email, 'emailVerification', { name, verificationLink });
};

export const sendPasswordResetEmail = async (email, name, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  return sendEmail(email, 'passwordReset', { name, resetLink });
};

export const sendPasswordChangedEmail = async (email, name) => {
  return sendEmail(email, 'passwordChanged', { name });
};

export const sendAccountLockedEmail = async (email, name, lockDuration = 15) => {
  return sendEmail(email, 'accountLocked', { name, lockDuration });
};

export const sendTwoFactorEnabledEmail = async (email, name) => {
  return sendEmail(email, 'twoFactorEnabled', { name });
};

export const sendPasswordExpiryWarningEmail = async (email, name, daysRemaining) => {
  return sendEmail(email, 'passwordExpiryWarning', { name, daysRemaining });
};

export const sendPasswordExpiredEmail = async (email, name) => {
  return sendEmail(email, 'passwordExpired', { name });
};

export default {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendAccountLockedEmail,
  sendTwoFactorEnabledEmail,
  sendPasswordExpiryWarningEmail,
  sendPasswordExpiredEmail,
};
