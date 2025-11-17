import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Send,
  Settings,
  Eye,
  Download,
  Maximize2,
  MessageSquare,
  Sparkles,
  Save,
  Undo,
  Redo,
  TestTube,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { campaignAPI, emailAPI } from '../utils/api'
import { useToast } from '../components/common/Toast'
import LoadingSpinner from '../components/common/LoadingSpinner'
import EmailCanvas from '../components/EmailCanvas'
import AIChat from '../components/AIChat'
import QuickActions from '../components/QuickActions'
import EditorContext from '../context/EditorContext'
import '../styles/dark-theme.css'

function CampaignEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState('preview')
  const [showChat, setShowChat] = useState(true)
  const [showSidebar, setShowSidebar] = useState(true)
  const [templateInstance, setTemplateInstance] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [testEmailsStatus, setTestEmailsStatus] = useState(null)

  const canvasRef = useRef(null)

  // Fetch campaign data
  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignAPI.getCampaign(id),
    enabled: !!id,
  })

  // Fetch template instance
  const { data: templateData, isLoading: templateLoading, refetch: refetchTemplate } = useQuery({
    queryKey: ['template-instance', id],
    queryFn: () => campaignAPI.getTemplateInstance(id),
    enabled: !!id,
  })

  // AI chat mutation
  const aiChatMutation = useMutation({
    mutationFn: (message) => campaignAPI.sendAIChat(id, message),
    onSuccess: (response, userMessage) => {
      setChatHistory(prev => [...prev, 
        { role: 'user', content: userMessage, timestamp: new Date() },
        { role: 'assistant', content: response.response, timestamp: new Date() }
      ])
      setIsAIProcessing(false)
      
      // If the AI made template changes, refresh the template
      if (response.template_updated) {
        refetchTemplate()
        toast.success('Template updated successfully!')
      }
    },
    onError: (error) => {
      toast.error(`AI Error: ${error.message}`)
      setIsAIProcessing(false)
    }
  })

  // AI template edit mutation
  const aiEditMutation = useMutation({
    mutationFn: (request) => campaignAPI.sendAIEdit(id, request),
    onSuccess: (response) => {
      if (response.success) {
        toast.success(response.message || 'Template updated successfully!')
        refetchTemplate()
        
        // Add to chat history
        setChatHistory(prev => [...prev,
          { role: 'user', content: response.user_request || 'Template modification', timestamp: new Date() },
          { role: 'assistant', content: response.message, timestamp: new Date(), changes: response.changes_applied }
        ])
      } else {
        toast.error(response.error || 'Failed to update template')
      }
      setIsAIProcessing(false)
    },
    onError: (error) => {
      toast.error(`Edit Error: ${error.message}`)
      setIsAIProcessing(false)
    }
  })

  // Save campaign mutation
  const saveCampaignMutation = useMutation({
    mutationFn: (data) => campaignAPI.updateCampaign(id, data),
    onSuccess: () => {
      toast.success('Campaign saved successfully!')
      queryClient.invalidateQueries(['campaign', id])
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`)
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
      toast.success('Test emails sent successfully!')
      setTimeout(() => setTestEmailsStatus(null), 3000)
    },
    onError: (error) => {
      console.error('Error sending test emails:', error)
      setTestEmailsStatus('error')
      toast.error('Failed to send test emails')
      setTimeout(() => setTestEmailsStatus(null), 3000)
    }
  })

  useEffect(() => {
    if (templateData?.template_instance) {
      setTemplateInstance(templateData.template_instance)
      
      // Load existing chat history
      const aiHistory = templateData.template_instance.ai_chat_history || []
      setChatHistory(aiHistory.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })))
    }
  }, [templateData])

  const handleSendMessage = (message) => {
    const trimmedMessage = message?.trim()
    if (!trimmedMessage) return
    setIsAIProcessing(true)
    
    // Check if this is an edit request
    const editKeywords = ['change', 'update', 'modify', 'make', 'edit', 'fix', 'adjust']
    const isEditRequest = editKeywords.some(keyword => 
      trimmedMessage.toLowerCase().includes(keyword)
    )
    
    if (isEditRequest) {
      aiEditMutation.mutate({ request: trimmedMessage })
    } else {
      aiChatMutation.mutate(trimmedMessage)
    }
  }

  const handleQuickAction = (action, data) => {
    setIsAIProcessing(true)
    
    let request = ''
    switch (action) {
      case 'change_title_color':
        request = `Change the title color to ${data.color}`
        break
      case 'change_button_color':
        request = `Change the button color to ${data.color}`
        break
      case 'update_title':
        request = `Change the main title to "${data.text}"`
        break
      case 'update_description':
        request = `Update the description to "${data.text}"`
        break
      default:
        request = `Apply quick action: ${action}`
    }
    
    aiEditMutation.mutate({ request })
  }

  const handleSaveCampaign = () => {
    if (templateInstance) {
      const updateData = {
        template_config: templateInstance.template_config,
        last_updated: new Date().toISOString()
      }
      saveCampaignMutation.mutate(updateData)
    }
  }

  const handleSendTest = () => {
    sendTestMutation.mutate(id)
  }

  if (campaignLoading || templateLoading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading campaign editor..." />
      </div>
    )
  }

  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">Campaign Not Found</h1>
          <button 
            onClick={() => navigate('/campaigns')}
            className="btn-primary"
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    )
  }

  return (
    <EditorContext.Provider value={{
      templateInstance,
      setTemplateInstance,
      campaign,
      chatHistory,
      setChatHistory,
      isAIProcessing,
      setIsAIProcessing,
      onSendMessage: handleSendMessage,
      onQuickAction: handleQuickAction,
      onSave: handleSaveCampaign
    }}>
      <div className="min-h-screen bg-dark-primary">
        {/* Header */}
        <header className="header-dark flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/campaigns')}
              className="btn-secondary flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            
            <div>
              <h1 className="text-xl font-bold text-primary">{campaign.campaign_name}</h1>
              <p className="text-muted text-sm">AI-Powered Email Editor</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Tab Navigation */}
            <div className="flex items-center space-x-1 bg-dark-secondary rounded-lg p-1">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-accent-blue text-white'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Preview
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-accent-blue text-white'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-1" />
                Settings
              </button>
            </div>
            
            {/* Action Buttons */}
            <button
              onClick={handleSendTest}
              disabled={sendTestMutation.isPending || testEmailsStatus === 'sending'}
              className="btn-secondary flex items-center space-x-2"
            >
              {testEmailsStatus === 'sending' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : testEmailsStatus === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Sent!</span>
                </>
              ) : testEmailsStatus === 'error' ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Failed</span>
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4" />
                  <span>Send Test</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveCampaign}
              disabled={saveCampaignMutation.isLoading}
              className="btn-success flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{saveCampaignMutation.isLoading ? 'Saving...' : 'Save'}</span>
            </button>

            <button
              onClick={() => setShowChat(!showChat)}
              className={`btn-secondary flex items-center space-x-2 ${showChat ? 'bg-accent-blue text-white' : ''}`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI Chat</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* Sidebar */}
          {showSidebar && (
            <aside className="sidebar-dark w-80 flex-shrink-0">
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-primary mb-3">Quick Actions</h2>
                  <QuickActions onAction={handleQuickAction} disabled={isAIProcessing} />
                </div>
                
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-primary mb-3">Campaign Info</h2>
                  <div className="card-dark">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-secondary">Status</label>
                        <p className="text-primary">{campaign.status}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">Total Emails</label>
                        <p className="text-primary">{campaign.total_emails || 0}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-secondary">Emails Sent</label>
                        <p className="text-primary">{campaign.emails_sent || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-primary mb-3">AI Commands</h2>
                  <div className="card-dark">
                    <div className="text-sm text-secondary space-y-2">
                      <p>• "Change title color to blue"</p>
                      <p>• "Make the button green"</p>
                      <p>• "Update the main title"</p>
                      <p>• "Add more padding"</p>
                      <p>• "Make text bigger"</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* Main Canvas Area */}
          <main className="flex-1 flex">
            <div className="flex-1 p-6">
              {activeTab === 'preview' ? (
                <EmailCanvas 
                  ref={canvasRef}
                  templateInstance={templateInstance}
                  isLoading={isAIProcessing}
                />
              ) : (
                <div className="card-dark h-full">
                  <h2 className="text-xl font-semibold text-primary mb-6">Campaign Settings</h2>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Campaign Name
                      </label>
                      <input
                        type="text"
                        value={campaign.campaign_name}
                        onChange={(e) => {
                          // Handle campaign name change
                        }}
                        className="input-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Subject Line
                      </label>
                      <input
                        type="text"
                        value={templateInstance?.template_config?.CAMPAIGN_TITLE || ''}
                        onChange={(e) => {
                          // Handle subject line change
                        }}
                        className="input-dark"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Description
                      </label>
                      <textarea
                        value={templateInstance?.template_config?.DESCRIPTION_TEXT || ''}
                        onChange={(e) => {
                          // Handle description change
                        }}
                        className="textarea-dark"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Chat Panel */}
            {showChat && (
              <AIChat
                onSendMessage={handleSendMessage}
                chatHistory={chatHistory}
                isProcessing={isAIProcessing}
                className="w-96 flex-shrink-0"
              />
            )}
          </main>
        </div>
      </div>
    </EditorContext.Provider>
  )
}

export default CampaignEditor
