import axios from 'axios'
import { API_CONFIG, getApiUrl } from '../config/api'

// Lambda Function URL adapter - Fixed to send direct HTTP requests
const lambdaFunctionAdapter = (config) => {
  return new Promise((resolve, reject) => {
    // Extract method and path from the URL
    const url = new URL(config.url, config.baseURL)
    const path = url.pathname
    const method = config.method.toUpperCase()
    
    // Build the full URL with path
    const fullUrl = `${config.baseURL}${path}`
    
    // Send direct HTTP request to Lambda Function URL
    axios({
      method: method,
      url: fullUrl,
      data: config.data,
      headers: config.headers || {},
      params: Object.fromEntries(url.searchParams),
      timeout: config.timeout
    }).then(response => {
      // Format response to match axios expectations
      const axiosResponse = {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: config,
        request: response.request
      }
      resolve(axiosResponse)
    }).catch(error => {
      reject(error)
    })
  })
}

// Create axios instances for different API endpoints
const campaignApi = axios.create({
  baseURL: API_CONFIG.CAMPAIGN_API,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: lambdaFunctionAdapter
})

const emailApi = axios.create({
  baseURL: API_CONFIG.EMAIL_API,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: lambdaFunctionAdapter
})

const aiTemplateApi = axios.create({
  baseURL: API_CONFIG.AI_TEMPLATE_API,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: lambdaFunctionAdapter
})

// Request interceptors
campaignApi.interceptors.request.use(
  (config) => {
    console.log(`Campaign API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('Campaign API Request Error:', error)
    return Promise.reject(error)
  }
)

emailApi.interceptors.request.use(
  (config) => {
    console.log(`Email API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('Email API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptors
const handleResponseError = (error) => {
  if (error.response) {
    // Server responded with error status
    console.error('API Response Error:', error.response.status, error.response.data)
    throw new Error(error.response.data?.error || `Request failed with status ${error.response.status}`)
  } else if (error.request) {
    // Request made but no response received
    console.error('API Network Error:', error.request)
    throw new Error('Network error - please check your internet connection and API endpoints')
  } else {
    // Something else happened
    console.error('API Error:', error.message)
    throw new Error(error.message)
  }
}

campaignApi.interceptors.response.use(
  (response) => response.data,
  handleResponseError
)

emailApi.interceptors.response.use(
  (response) => response.data,
  handleResponseError
)

aiTemplateApi.interceptors.response.use(
  (response) => response.data,
  handleResponseError
)

// Campaign API functions
export const campaignAPI = {
  // Campaigns
  getCampaigns: () => campaignApi.get('/api/campaigns'),
  createCampaign: (data) => campaignApi.post('/api/campaigns', data),
  getCampaign: (id) => campaignApi.get(`/api/campaigns/${id}`),
  updateCampaign: (id, data) => campaignApi.put(`/api/campaigns/${id}`, data),
  deleteCampaign: (id) => campaignApi.delete(`/api/campaigns/${id}`),
  
  // File upload
  uploadFile: (campaignId, fileData) =>
    campaignApi.post(`/api/campaigns/${campaignId}/upload`, fileData),

  // Hero image upload
  uploadHeroImage: (campaignId, imageData) =>
    campaignApi.post(`/api/campaigns/${campaignId}/upload-hero-image`, imageData),

  // Campaign processing
  processCampaign: (campaignId) =>
    campaignApi.post(`/api/campaigns/${campaignId}/process`),

  // AI generation
  aiGenerateContent: (campaignId) =>
    campaignApi.post(`/api/campaigns/${campaignId}/ai-generate`),

  // Batches
  getCampaignBatches: (campaignId) =>
    campaignApi.get(`/api/campaigns/${campaignId}/batches`),

  getBatchRecipients: (campaignId, batchNumber) =>
    campaignApi.get(`/api/campaigns/${campaignId}/batches/${batchNumber}/recipients`),

  previewRecipientEmail: (campaignId, recordId) =>
    campaignApi.get(`/api/campaigns/${campaignId}/preview/${recordId}`),

  // Test user preview (shows real test user data with products)
  getTestPreview: (campaignId) =>
    campaignApi.get(`/api/campaigns/${campaignId}/test-preview`),

  // Colleges
  getColleges: () => campaignApi.get('/api/colleges'),
  createCollege: (data) => campaignApi.post('/api/colleges', data),
  updateCollege: (schoolCode, data) => campaignApi.put(`/api/colleges/${schoolCode}`, data),
  deleteCollege: (schoolCode) => campaignApi.delete(`/api/colleges/${schoolCode}`),
  
  // Email campaign data
  getEmailCampaignData: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString()
    return campaignApi.get(`/api/email-campaign-data${queryParams ? `?${queryParams}` : ''}`)
  },
  
  // Test users
  getTestUsers: () => campaignApi.get('/api/test-users'),
  createTestUser: (data) => campaignApi.post('/api/test-users', data),
  deleteTestUser: (email) => campaignApi.delete(`/api/test-users/${email}`),
  
  // Template instances (AI Template service)
  getTemplateInstance: (campaignId) => aiTemplateApi.get(`/api/campaigns/${campaignId}/template-instance`),
  createTemplateInstance: (campaignId, data = {}) => aiTemplateApi.post(`/api/campaigns/${campaignId}/create-template-instance`, data),
  updateTemplateConfig: (campaignId, config) => campaignApi.put(`/api/campaigns/${campaignId}/template-config`, { template_config: config }),

  // AI Template Editor functions
  sendAIChat: (campaignId, message) => aiTemplateApi.post(`/api/campaigns/${campaignId}/ai-chat`, { message }),
  sendAIEdit: (campaignId, request) => aiTemplateApi.post(`/api/campaigns/${campaignId}/ai-edit`, request),
  getAIHealth: () => aiTemplateApi.get('/api/health'),
}

// Email API functions
export const emailAPI = {
  // Send batch emails
  sendBatch: (campaignId, batchNumber) => 
    emailApi.post(`/api/campaigns/${campaignId}/send-batch`, { batch_number: batchNumber }),
  
  // Send test emails
  sendTest: (campaignId) => 
    emailApi.post(`/api/campaigns/${campaignId}/send-test`),
}

// File utilities
export const fileUtils = {
  // Convert file to base64 for upload
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        // Remove data:type;base64, prefix
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = (error) => reject(error)
    })
  },
  
  // Validate file
  validateFile: (file) => {
    const errors = []
    
    if (!file) {
      errors.push('No file selected')
      return errors
    }
    
    if (file.size > API_CONFIG.MAX_FILE_SIZE) {
      errors.push(`File size exceeds ${API_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB limit`)
    }
    
    if (!API_CONFIG.ALLOWED_FILE_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      errors.push('File must be a CSV file')
    }
    
    return errors
  }
}

// Progress polling utility
export const progressPoller = {
  start: (pollFunction, interval = API_CONFIG.PROGRESS_POLL_INTERVAL) => {
    const intervalId = setInterval(pollFunction, interval)
    
    return {
      stop: () => clearInterval(intervalId),
      intervalId
    }
  }
}

// Error handling utilities
export const errorUtils = {
  // Extract meaningful error message
  getErrorMessage: (error) => {
    if (typeof error === 'string') return error
    if (error?.message) return error.message
    if (error?.response?.data?.error) return error.response.data.error
    return 'An unexpected error occurred'
  },
  
  // Check if error is network related
  isNetworkError: (error) => {
    return !error.response && error.request
  },
  
  // Check if error is server error (5xx)
  isServerError: (error) => {
    return error.response && error.response.status >= 500
  },
  
  // Check if error is client error (4xx)
  isClientError: (error) => {
    return error.response && error.response.status >= 400 && error.response.status < 500
  }
}
