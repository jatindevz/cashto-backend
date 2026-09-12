// src/services/smsService.ts
// Service to dispatch real SMS OTPs via Fast2SMS / Twilio

export async function sendRealSmsOtp(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    console.log(`[SMS-SERVICE] FAST2SMS_API_KEY is not set. Simulating SMS for ${phone}: ${otp}`);
    return false;
  }

  try {
    // Fast2SMS Quick Transactional Route API
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: phone.replace(/^\+91/, ''), // 10 digit Indian number
      }),
    });

    const result = await response.json();
    console.log(`[SMS-SERVICE] Fast2SMS response for ${phone}:`, result);
    return result.return === true;
  } catch (err) {
    console.error(`[SMS-SERVICE] Error sending SMS to ${phone}:`, err);
    return false;
  }
}
