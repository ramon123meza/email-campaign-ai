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
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Edit,
  X
} from 'lucide-react'
import { campaignAPI, emailAPI, errorUtils } from '../utils/api'

function CampaignDetail() {
  const { id } = useParams()
  const [sendingBatch, setSendingBatch] = useState(null)
  const [testEmailsStatus, setTestEmailsStatus] = useState(null)
  const [expandedBatches, setExpandedBatches] = useState({})
  const [batchRecipients, setBatchRecipients] = useState({})
  const [loadingRecipients, setLoadingRecipients] = useState({})
  const [previewModal, setPreviewModal] = useState(null) // {recipient, html}

  const queryClient = useQueryClient()

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
    if (confirm(`Send batch ${batchNumber} to all recipients? This action cannot be undone.`)) {
      sendBatchMutation.mutate({ campaignId: id, batchNumber })
    }
  }

  const handleSendTest = () => {
    sendTestMutation.mutate(id)
  }

  const toggleBatchExpansion = async (batchNumber) => {
    const newExpandedState = !expandedBatches[batchNumber]
    setExpandedBatches(prev => ({ ...prev, [batchNumber]: newExpandedState }))

    // Load recipients if expanding and not already loaded
    if (newExpandedState && !batchRecipients[batchNumber]) {
      setLoadingRecipients(prev => ({ ...prev, [batchNumber]: true }))
      try {
        const recipients = await campaignAPI.getBatchRecipients(id, batchNumber)
        setBatchRecipients(prev => ({ ...prev, [batchNumber]: recipients }))
      } catch (error) {
        console.error('Error loading recipients:', error)
      } finally {
        setLoadingRecipients(prev => ({ ...prev, [batchNumber]: false }))
      }
    }
  }

  const handlePreviewEmail = async (recipient) => {
    try {
      // Call API to generate preview for this specific recipient
      const preview = await campaignAPI.previewRecipientEmail(id, recipient.record_id)
      setPreviewModal({ recipient, html: preview.html })
    } catch (error) {
      console.error('Error previewing email:', error)
      alert('Failed to generate email preview')
    }
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

          {(campaign.status === 'draft' || campaign.status === 'ready') && (
            <>
              <Link
                to={`/campaigns/${id}/editor`}
                className="btn-primary flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                AI Template Editor
              </Link>
            </>
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
              <div key={batch.batch_number} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Batch Header */}
                <div className="bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <button
                          onClick={() => toggleBatchExpansion(batch.batch_number)}
                          className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                        >
                          {expandedBatches[batch.batch_number] ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          <h4 className="font-medium text-gray-900">
                            Batch {batch.batch_number}
                          </h4>
                        </button>
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

                {/* Batch Recipients (Expandable) */}
                {expandedBatches[batch.batch_number] && (
                  <div className="border-t border-gray-200 bg-white p-4">
                    {loadingRecipients[batch.batch_number] ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="loading-spinner"></div>
                        <span className="ml-2 text-gray-600">Loading recipients...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h5 className="text-sm font-semibold text-gray-700 mb-3">
                          Recipients ({batchRecipients[batch.batch_number]?.length || 0})
                        </h5>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {(batchRecipients[batch.batch_number] || []).map((recipient) => (
                            <div
                              key={recipient.record_id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <Mail className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {recipient.customer_name || 'Unknown'}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {recipient.customer_email}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-1 ml-7 flex items-center gap-4 text-xs text-gray-500">
                                  <span>School: {recipient.school_code || 'N/A'}</span>
                                  <span>
                                    Products: {[1,2,3,4].filter(i => recipient[`product_image_${i}`]).length}
                                  </span>
                                  {recipient.email_sent && (
                                    <span className="flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-3 w-3" />
                                      Sent
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handlePreviewEmail(recipient)}
                                className="btn-secondary btn-sm flex items-center gap-2"
                              >
                                <Eye className="h-3 w-3" />
                                Preview
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
                <p className="text-sm text-gray-600">
                  {previewModal.recipient.customer_name} ({previewModal.recipient.customer_email})
                </p>
              </div>
              <button
                onClick={() => setPreviewModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <iframe
                srcDoc={previewModal.html}
                className="w-full h-full border-0 bg-white rounded-lg"
                style={{ minHeight: '600px' }}
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CampaignDetail
