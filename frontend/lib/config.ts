const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  isDevelopment,
  
  api: {
    baseUrl: isProduction
      ? process.env.NEXT_PUBLIC_API_URL_PROD || 'https://your-production-api.com'
      : process.env.NEXT_PUBLIC_API_URL_DEV || 'http://localhost:5001',
    wsUrl: isProduction
      ? process.env.NEXT_PUBLIC_WS_URL_PROD || 'wss://your-production-api.com'
      : process.env.NEXT_PUBLIC_WS_URL_DEV || 'ws://localhost:5001',
  },
  
  twilio: {
    phoneNumber: isProduction
      ? process.env.NEXT_PUBLIC_TWILIO_PHONE_PROD
      : process.env.NEXT_PUBLIC_TWILIO_PHONE_DEV,
  },
  
  features: {
    multiTenant: process.env.NEXT_PUBLIC_ENABLE_MULTI_TENANT === 'true',
  },
};

export default config;