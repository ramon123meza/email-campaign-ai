// API Configuration
// Lambda Function URLs (Direct invocation, no API Gateway)

export const API_CONFIG = {
  // Campaign Management Lambda Function URL
  CAMPAIGN_API: import.meta.env.VITE_CAMPAIGN_API_URL || 'https://2h7bk75jscgiryp6zt4dh3htsy0aovsr.lambda-url.us-east-1.on.aws',
  
  // Email Sending Lambda Function URL  
  EMAIL_API: import.meta.env.VITE_EMAIL_API_URL || 'https://myylk2rmfu3njaqfxzwyvmyaru0sgwlv.lambda-url.us-east-1.on.aws',
  
  // AI Template Editor Lambda Function URL
  AI_TEMPLATE_API: import.meta.env.VITE_AI_TEMPLATE_API_URL || 'https://jya2onwln6iewhxhxbrjwzpd7a0oudxo.lambda-url.us-east-1.on.aws',
  
  // Request timeout in milliseconds
  TIMEOUT: 30000,
  
  // File upload limits
  MAX_FILE_SIZE: (import.meta.env.VITE_MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['text/csv', 'application/vnd.ms-excel'],
  
  // Batch configuration (should match Lambda settings)
  EMAILS_PER_BATCH: parseInt(import.meta.env.VITE_EMAILS_PER_BATCH) || 2000,
  
  // Polling intervals for progress updates (in milliseconds)
  PROGRESS_POLL_INTERVAL: 5000, // 5 seconds
  
  // Default values
  DEFAULT_COMPANY_INFO: {
    name: 'R and R Imports, Inc',
    address: '5271 Lee Hwy, Troutville, VA 24175-7555 USA',
    email: 'hello@rrinconline.com'
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint, isEmailApi = false) => {
  const baseUrl = isEmailApi ? API_CONFIG.EMAIL_API : API_CONFIG.CAMPAIGN_API;
  return `${baseUrl}${endpoint}`;
};

// Validation functions
export const validateApiConfig = () => {
  const errors = [];
  
  if (!API_CONFIG.CAMPAIGN_API || API_CONFIG.CAMPAIGN_API.includes('YOUR_CAMPAIGN_LAMBDA_URL')) {
    errors.push('Campaign API URL not configured');
  }
  
  if (!API_CONFIG.EMAIL_API || API_CONFIG.EMAIL_API.includes('YOUR_EMAIL_LAMBDA_URL')) {
    errors.push('Email API URL not configured');
  }
  
  // Test if endpoints are reachable (basic validation)
  try {
    const campaignUrl = new URL(API_CONFIG.CAMPAIGN_API);
    const emailUrl = new URL(API_CONFIG.EMAIL_API);
    
    if (!campaignUrl.hostname.includes('lambda-url') || !emailUrl.hostname.includes('lambda-url')) {
      errors.push('API endpoints should be Lambda Function URLs');
    }
  } catch (e) {
    errors.push('Invalid API endpoint URLs');
  }
  
  return errors;
};