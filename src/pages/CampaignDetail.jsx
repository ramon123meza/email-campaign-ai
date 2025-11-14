import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Send,
  TestTube,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Mail,
  Calendar,
  FileText,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Edit3,
  Upload,
  X,
  Image as ImageIcon
} from 'lucide-react'
import { campaignAPI, emailAPI, errorUtils, progressPoller } from '../utils/api'

function CampaignDetail() {
  const { id } = useParams()
  const [sendingBatch, setSendingBatch] = useState(null)
  const [testEmailsStatus, setTestEmailsStatus] = useState(null)
  const [showEmailPreview, setShowEmailPreview] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const queryClient = useQueryClient()

  // Image upload handler
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    setUploadingImage(true)

    try {
      // Read file as base64
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = async () => {
        const base64 = reader.result.split(',')[1]

        // For now, just update the image URL locally
        // You would call an API endpoint here to upload to S3
        const imageUrl = reader.result // Use data URL for preview

        const updated = {
          ...campaign,
          template_config: {
            ...campaign.template_config,
            main_image_url: imageUrl
          }
        }

        // Update local cache
        queryClient.setQueryData(['campaign', id], updated)

        // Save to database
        await campaignAPI.updateCampaign(id, {
          name: campaign.campaign_name,
          template_config: updated.template_config
        })

        setUploadingImage(false)
      }

      reader.onerror = () => {
        alert('Failed to read image file')
        setUploadingImage(false)
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image')
      setUploadingImage(false)
    }
  }

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignAPI.getCampaign(id),
    enabled: !!id,
  })

  // Fetch campaign batches
  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ['campaign-batches', id],
    queryFn: () => campaignAPI.getCampaignBatches(id),
    enabled: !!id,
    refetchInterval: 5000, // Refresh every 5 seconds for progress updates
  })

  // Send batch mutation
  const sendBatchMutation = useMutation({
    mutationFn: ({ campaignId, batchNumber }) => emailAPI.sendBatch(campaignId, batchNumber),
    onMutate: ({ batchNumber }) => {
      setSendingBatch(batchNumber)
    },
    onSuccess: (data, { batchNumber }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-batches', id] })
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      setSendingBatch(null)
    },
    onError: (error, { batchNumber }) => {
      console.error('Error sending batch:', error)
      setSendingBatch(null)
    }
  })

  // Send test emails mutation
  const sendTestMutation = useMutation({
    mutationFn: (campaignId) => emailAPI.sendTest(campaignId),
    onMutate: () => {
      setTestEmailsStatus('sending')
    },
    onSuccess: (data) => {
      setTestEmailsStatus('success')
      setTimeout(() => setTestEmailsStatus(null), 3000)
    },
    onError: (error) => {
      console.error('Error sending test emails:', error)
      setTestEmailsStatus('error')
      setTimeout(() => setTestEmailsStatus(null), 3000)
    }
  })

  const batches = batchesData?.batches || []

  // Status configuration for batches
  const statusConfig = {
    ready: { 
      color: 'blue', 
      bg: 'bg-blue-100', 
      text: 'text-blue-800', 
      icon: Clock,
      label: 'Ready to Send'
    },
    sending: { 
      color: 'yellow', 
      bg: 'bg-yellow-100', 
      text: 'text-yellow-800', 
      icon: RefreshCw,
      label: 'Sending...'
    },
    completed: { 
      color: 'green', 
      bg: 'bg-green-100', 
      text: 'text-green-800', 
      icon: CheckCircle,
      label: 'Completed'
    },
    failed: { 
      color: 'red', 
      bg: 'bg-red-100', 
      text: 'text-red-800', 
      icon: AlertTriangle,
      label: 'Failed'
    }
  }

  const BatchStatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig.ready
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className={`h-3 w-3 ${status === 'sending' ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
    )
  }

  const handleSendBatch = (batchNumber) => {
    sendBatchMutation.mutate({ campaignId: id, batchNumber })
  }

  const handleSendTest = () => {
    sendTestMutation.mutate(id)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not started'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getProgressPercentage = (batch) => {
    if (batch.batch_size === 0) return 0
    return Math.round((batch.emails_sent / batch.batch_size) * 100)
  }

  const getTotalProgress = () => {
    if (!campaign?.total_emails || campaign.total_emails === 0) return 0
    return Math.round((campaign.emails_sent / campaign.total_emails) * 100)
  }

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-gray-600">Loading campaign...</span>
      </div>
    )
  }

  if (campaignError || !campaign) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign not found</h3>
        <p className="text-gray-600 mb-4">
          {campaignError ? errorUtils.getErrorMessage(campaignError) : 'The campaign you\'re looking for doesn\'t exist.'}
        </p>
        <Link to="/campaigns" className="btn-primary">
          Back to Campaigns
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to="/campaigns" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{campaign.campaign_name}</h1>
          <p className="text-gray-600">Campaign details and batch management</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSendTest}
            disabled={sendTestMutation.isPending || testEmailsStatus === 'sending'}
            className="btn-secondary flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {testEmailsStatus === 'sending' ? 'Sending...' : 'Send Test'}
          </button>
          
          {campaign.status === 'draft' && (
            <Link to={`/campaigns/${id}/edit`} className="btn-primary">
              Edit Campaign
            </Link>
          )}
        </div>
      </div>

      {/* Test Email Status */}
      {testEmailsStatus && (
        <div className={`card p-4 border-l-4 ${
          testEmailsStatus === 'success' ? 'border-green-500 bg-green-50' :
          testEmailsStatus === 'error' ? 'border-red-500 bg-red-50' :
          'border-blue-500 bg-blue-50'
        }`}>
          <div className="flex items-center gap-2">
            {testEmailsStatus === 'sending' && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
            {testEmailsStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {testEmailsStatus === 'error' && <AlertTriangle className="h-4 w-4 text-red-600" />}
            <span className="font-medium">
              {testEmailsStatus === 'sending' && 'Sending test emails...'}
              {testEmailsStatus === 'success' && 'Test emails sent successfully!'}
              {testEmailsStatus === 'error' && 'Failed to send test emails'}
            </span>
          </div>
        </div>
      )}

      {/* Campaign Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Info */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Information</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Created</p>
                <p className="text-sm text-gray-600">{formatDate(campaign.created_at)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Total Recipients</p>
                <p className="text-sm text-gray-600">{campaign.total_emails?.toLocaleString() || 0}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Emails Sent</p>
                <p className="text-sm text-gray-600">{campaign.emails_sent?.toLocaleString() || 0}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Status</p>
                <p className="text-sm text-gray-600 capitalize">{campaign.status}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Progress</h3>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {getTotalProgress()}%
              </div>
              <p className="text-sm text-gray-600">Complete</p>
            </div>
            
            <div className="progress-bar h-4">
              <div 
                className="progress-fill" 
                style={{ width: `${getTotalProgress()}%` }}
              />
            </div>
            
            <div className="flex justify-between text-sm text-gray-600">
              <span>{campaign.emails_sent || 0} sent</span>
              <span>{campaign.total_emails || 0} total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email Preview & Editor */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-600" />
            Email Preview
          </h3>
          <button
            onClick={() => setEditingTemplate(!editingTemplate)}
            className="btn-secondary flex items-center gap-2"
          >
            <Edit3 className="h-4 w-4" />
            {editingTemplate ? 'View Preview' : 'Edit Template'}
          </button>
        </div>

        {editingTemplate ? (
          /* Email Editor Mode */
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900">
                Edit your email template below. Changes will apply to all emails in this campaign.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Campaign Name</label>
                <input
                  type="text"
                  value={campaign.campaign_name || ''}
                  onChange={(e) => {
                    const updated = { ...campaign, campaign_name: e.target.value }
                    queryClient.setQueryData(['campaign', id], updated)
                  }}
                  className="input"
                  placeholder="Enter campaign name"
                />
              </div>

              <div>
                <label className="label">Email Subject Line</label>
                <input
                  type="text"
                  value={campaign.template_config?.subject_line || ''}
                  onChange={(e) => {
                    const updated = {
                      ...campaign,
                      template_config: {
                        ...campaign.template_config,
                        subject_line: e.target.value
                      }
                    }
                    queryClient.setQueryData(['campaign', id], updated)
                  }}
                  className="input"
                  placeholder="Enter email subject"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Main Email Title</label>
                <input
                  type="text"
                  value={campaign.template_config?.main_title || ''}
                  onChange={(e) => {
                    const updated = {
                      ...campaign,
                      template_config: {
                        ...campaign.template_config,
                        main_title: e.target.value
                      }
                    }
                    queryClient.setQueryData(['campaign', id], updated)
                  }}
                  className="input"
                  placeholder="Enter main title"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Description</label>
                <textarea
                  value={campaign.template_config?.description || ''}
                  onChange={(e) => {
                    const updated = {
                      ...campaign,
                      template_config: {
                        ...campaign.template_config,
                        description: e.target.value
                      }
                    }
                    queryClient.setQueryData(['campaign', id], updated)
                  }}
                  className="input"
                  rows={4}
                  placeholder="Enter email description"
                />
              </div>

              <div>
                <label className="label">Call-to-Action Text</label>
                <input
                  type="text"
                  value={campaign.template_config?.cta_text || 'Shop Now'}
                  onChange={(e) => {
                    const updated = {
                      ...campaign,
                      template_config: {
                        ...campaign.template_config,
                        cta_text: e.target.value
                      }
                    }
                    queryClient.setQueryData(['campaign', id], updated)
                  }}
                  className="input"
                  placeholder="Enter CTA text"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Main Campaign Image</label>

                {/* Image Upload Zone */}
                <div className="space-y-3">
                  {campaign.template_config?.main_image_url ? (
                    /* Show current image with remove option */
                    <div className="relative inline-block">
                      <img
                        src={campaign.template_config.main_image_url}
                        alt="Campaign header"
                        className="max-w-md w-full h-auto rounded-lg border-2 border-gray-200"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/600x300?text=Campaign+Image'
                        }}
                      />
                      <button
                        onClick={() => {
                          const updated = {
                            ...campaign,
                            template_config: {
                              ...campaign.template_config,
                              main_image_url: ''
                            }
                          }
                          queryClient.setQueryData(['campaign', id], updated)
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    /* Show upload placeholder */
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-2">No image uploaded yet</p>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex items-center gap-3">
                    <label className="btn-primary inline-flex items-center gap-2 cursor-pointer">
                      {uploadingImage ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {campaign.template_config?.main_image_url ? 'Change Image' : 'Upload Image'}
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>

                    {/* Optional: Manual URL input */}
                    <span className="text-gray-500">or</span>
                    <input
                      type="url"
                      value={campaign.template_config?.main_image_url || ''}
                      onChange={(e) => {
                        const updated = {
                          ...campaign,
                          template_config: {
                            ...campaign.template_config,
                            main_image_url: e.target.value
                          }
                        }
                        queryClient.setQueryData(['campaign', id], updated)
                      }}
                      className="input flex-1"
                      placeholder="Or paste image URL"
                    />
                  </div>

                  <p className="text-xs text-gray-500">
                    Upload a header image for your campaign (max 5MB, JPG/PNG recommended)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={async () => {
                  try {
                    await campaignAPI.updateCampaign(id, {
                      name: campaign.campaign_name,
                      template_config: campaign.template_config
                    })
                    queryClient.invalidateQueries({ queryKey: ['campaign', id] })
                    setEditingTemplate(false)
                    // Show success toast if available
                  } catch (error) {
                    console.error('Failed to save changes:', error)
                  }
                }}
                className="btn-primary"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditingTemplate(false)
                  queryClient.invalidateQueries({ queryKey: ['campaign', id] })
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Email Preview Mode */
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Subject:</span>
                <span>{campaign.template_config?.subject_line || campaign.template_config?.main_title || 'New Collection Available!'}</span>
              </div>
            </div>

            <div className="bg-white p-6 max-w-2xl mx-auto">
              {/* Email Header Preview */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {campaign.template_config?.main_title || 'New Collection Available!'}
                </h1>
                <div className="h-0.5 bg-gray-900 w-24 mx-auto"></div>
              </div>

              {/* Hero Image */}
              {campaign.template_config?.main_image_url && (
                <div className="mb-6">
                  <img
                    src={campaign.template_config.main_image_url}
                    alt="Campaign Hero"
                    className="w-full rounded-lg"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              )}

              {/* Email Content */}
              <div className="text-center mb-6">
                <p className="text-gray-700 mb-4">
                  Hi [Customer Name],
                </p>
                <p className="text-gray-700 mb-6">
                  {campaign.template_config?.description || 'Check out our latest collection selected just for you!'}
                </p>
              </div>

              {/* Sample Products Preview */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-lg p-3 text-center">
                      <div className="bg-gray-200 aspect-square rounded mb-2 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-600">Product {i}</p>
                      <p className="text-sm font-semibold">$XX.XX</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Button */}
              <div className="text-center mb-6">
                <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  {campaign.template_config?.cta_text || 'Shop Now'}
                </button>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 pt-6 border-t border-gray-200">
                <p className="mb-2">{campaign.template_config?.footer_text || 'R and R Imports, Inc'}</p>
                <p>{campaign.template_config?.company_address || '5271 Lee Hwy, Troutville, VA 24175-7555 USA'}</p>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-600">
                This is a preview. Actual emails will include personalized product recommendations for each recipient.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Batch Management */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Email Batches</h3>
          <p className="text-sm text-gray-600">
            {batches.length} batches • 2,000 emails per batch
          </p>
        </div>

        {batchesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="loading-spinner"></div>
            <span className="ml-2 text-gray-600">Loading batches...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No batches created</h4>
            <p className="text-gray-600">
              Process your campaign file to create email batches for sending.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {batches.map((batch) => (
              <div key={batch.batch_number} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h4 className="font-medium text-gray-900">
                        Batch {batch.batch_number}
                      </h4>
                      <BatchStatusBadge status={batch.status} />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Size:</span> {batch.batch_size} emails
                      </div>
                      <div>
                        <span className="font-medium">Sent:</span> {batch.emails_sent || 0}
                      </div>
                      <div>
                        <span className="font-medium">Est. Duration:</span> {batch.estimated_duration_minutes}min
                      </div>
                      <div>
                        <span className="font-medium">Started:</span> {formatDate(batch.started_at)}
                      </div>
                    </div>
                    
                    {batch.status === 'sending' || batch.status === 'completed' ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">
                            {getProgressPercentage(batch)}%
                          </span>
                        </div>
                        <div className="progress-bar h-2">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${getProgressPercentage(batch)}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  
                  <div className="ml-4">
                    {batch.status === 'ready' && (
                      <button
                        onClick={() => handleSendBatch(batch.batch_number)}
                        disabled={sendingBatch === batch.batch_number || sendBatchMutation.isPending}
                        className="btn-success flex items-center gap-2"
                      >
                        {sendingBatch === batch.batch_number ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send Batch
                          </>
                        )}
                      </button>
                    )}
                    
                    {batch.status === 'sending' && (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Sending...</span>
                      </div>
                    )}
                    
                    {batch.status === 'completed' && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Complete</span>
                      </div>
                    )}
                    
                    {batch.status === 'failed' && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Failed</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {batch.error_message && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Error:</strong> {batch.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CampaignDetail