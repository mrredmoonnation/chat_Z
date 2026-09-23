import emailjs from '@emailjs/browser';

const EMAILJS_CONFIG_KEY = 'chatz_emailjs_config_v1';

export const getEmailJsConfig = () => {
  const localConfig = (() => {
    try {
      const raw = localStorage.getItem(EMAILJS_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  })();

  return {
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || localConfig?.serviceId || '',
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || localConfig?.templateId || '',
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || localConfig?.publicKey || ''
  };
};

export const saveEmailJsConfig = (config) => {
  try {
    localStorage.setItem(EMAILJS_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save EmailJS config to localStorage:', e);
  }
};

export const isEmailJsConfigured = () => {
  const cfg = getEmailJsConfig();
  return Boolean(cfg.serviceId && cfg.templateId && cfg.publicKey);
};

/**
 * Send real 6-digit OTP code to user's Gmail using EmailJS
 * @param {string} toEmail User's Gmail address
 * @param {string} otpCode 6-digit OTP code
 * @param {string} toName Optional user name
 */
export const sendRealEmailOtp = async (toEmail, otpCode, toName = 'Chatz User') => {
  const cfg = getEmailJsConfig();

  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) {
    return {
      success: false,
      sentVia: 'demo_fallback',
      message: 'EmailJS keys not configured. To send real emails to your Gmail inbox, add EmailJS Service ID, Template ID, and Public Key.'
    };
  }

  const templateParams = {
    to_email: toEmail,
    email: toEmail,
    user_email: toEmail,
    recipient_email: toEmail,
    reply_to: toEmail,
    to_name: toName,
    name: toName,
    from_name: 'Chatz Web',
    otp_code: otpCode,
    otp: otpCode,
    code: otpCode,
    passcode: otpCode,
    message: `Your Chatz Web verification code is: ${otpCode}`,
    app_name: 'Chatz Web',
    time: new Date().toLocaleTimeString()
  };

  try {
    const response = await emailjs.send(
      cfg.serviceId,
      cfg.templateId,
      templateParams,
      cfg.publicKey
    );

    console.log('EmailJS send response:', response);
    return {
      success: true,
      sentVia: 'emailjs',
      status: response.status,
      message: `Real OTP successfully sent to ${toEmail}!`
    };
  } catch (error) {
    console.error('EmailJS send error:', error);
    return {
      success: false,
      sentVia: 'error',
      error: error?.text || error?.message || 'Failed to send email via EmailJS',
      message: error?.text || error?.message || 'Failed to deliver OTP email.'
    };
  }
};
