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
  RefreshCw,
  Upload,
  Image
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
  const [uploadingHero, setUploadingHero] = useState(false)
  const [selectedTestUserEmail, setSelectedTestUserEmail] = useState(null)

  const canvasRef = useRef(null)
  const heroImageInputRef = useRef(null)
  const saveTimeoutRef = useRef(null)

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

  // Fetch all test users for dropdown
  const { data: testUsers } = useQuery({
    queryKey: ['test-users'],
    queryFn: () => campaignAPI.getTestUsers(),
  })

  // Fetch test user preview (shows real test user data with products)
  // ALWAYS fetch fresh personalized preview - never use cached placeholders
  const { data: testPreviewData, isLoading: testPreviewLoading, refetch: refetchTestPreview } = useQuery({
    queryKey: ['test-preview', id, selectedTestUserEmail],
    queryFn: () => campaignAPI.getTestPreview(id, selectedTestUserEmail),
    enabled: !!id && !!selectedTestUserEmail,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus (too aggressive)
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

      // If the AI made template changes, refresh the template and test preview
      if (response.template_updated) {
        queryClient.invalidateQueries(['template-instance', id])
        queryClient.invalidateQueries(['test-preview', id, selectedTestUserEmail])
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
        queryClient.invalidateQueries(['template-instance', id])
        queryClient.invalidateQueries(['test-preview', id, selectedTestUserEmail])

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
      console.log('✅ Test email SUCCESS:', data)
      setTestEmailsStatus('success')

      // Show detailed success message
      const message = data?.message || 'Test emails sent successfully!'
      const count = data?.emails_sent || 0
      const failed = data?.failed_emails || 0

      if (failed > 0) {
        toast.success(`${message} (${count} sent, ${failed} failed)`, { duration: 5000 })
      } else {
        toast.success(`${message} (${count} sent)`, { duration: 4000 })
      }

      setTimeout(() => setTestEmailsStatus(null), 3000)
    },
    onError: (error) => {
      console.error('❌ Test email ERROR:', error)
      console.error('Error response:', error.response)
      console.error('Error message:', error.message)

      // The backend returns proper success now, so any error is real
      setTestEmailsStatus('error')

      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error'
      toast.error(`Failed to send test emails: ${errorMsg}`, { duration: 5000 })

      setTimeout(() => setTestEmailsStatus(null), 3000)
    }
  })

  // Hero image upload mutation
  const heroImageMutation = useMutation({
    mutationFn: (imageData) => campaignAPI.uploadHeroImage(id, imageData),
    onSuccess: (data) => {
      toast.success('Hero image uploaded successfully!')
      // Force immediate refetch of both template and preview
      queryClient.invalidateQueries(['template-instance', id])
      queryClient.invalidateQueries(['test-preview', id, selectedTestUserEmail])
      setUploadingHero(false)
    },
    onError: (error) => {
      console.error('Error uploading hero image:', error)
      toast.error('Failed to upload hero image')
      setUploadingHero(false)
    }
  })

  // Template config update mutation (for settings changes)
  const updateConfigMutation = useMutation({
    mutationFn: (config) => campaignAPI.updateTemplateConfig(id, config),
    onSuccess: (data) => {
      console.log('Config updated, refetching preview...')
      // Immediately refetch to show updated preview
      queryClient.invalidateQueries(['template-instance', id])
      queryClient.invalidateQueries(['test-preview', id, selectedTestUserEmail])
    },
    onError: (error) => {
      console.error('Error updating template config:', error)
      toast.error('Failed to update template settings')
    }
  })

  // Set initial test user from test users list
  useEffect(() => {
    if (testUsers?.users && !selectedTestUserEmail) {
      const activeUsers = testUsers.users.filter(u => u.active)
      if (activeUsers.length > 0) {
        console.log('Setting initial test user:', activeUsers[0].email)
        setSelectedTestUserEmail(activeUsers[0].email)
      }
    }
  }, [testUsers, selectedTestUserEmail])

  useEffect(() => {
    // ALWAYS use test preview data - never show raw template with placeholders
    if (testPreviewData?.html) {
      console.log('✅ Using personalized preview for:', testPreviewData.test_user?.name)

      const instance = templateData?.template_instance || {}

      // Override with personalized preview
      instance.template_html = testPreviewData.html
      instance.test_user_info = testPreviewData.test_user

      setTemplateInstance(instance)

      // Load existing chat history
      const aiHistory = instance.ai_chat_history || []
      setChatHistory(aiHistory.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })))
    } else {
      console.log('⏳ Waiting for test preview data...')
      // Don't set templateInstance until we have personalized data
      // This prevents showing raw placeholders
    }
  }, [templateData, testPreviewData])

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

  // Debounced template config save (saves 500ms after last change)
  const handleConfigChange = (newConfig) => {
    // Update local state immediately for responsive UI
    setTemplateInstance(prev => ({ ...prev, template_config: newConfig }))

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout to save after 500ms of no changes
    saveTimeoutRef.current = setTimeout(() => {
      updateConfigMutation.mutate(newConfig)
    }, 500)
  }

  const handleHeroImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB')
      return
    }

    setUploadingHero(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const base64String = e.target.result.split(',')[1]

        const imageData = {
          image_content: base64String,
          file_name: file.name,
          content_type: file.type
        }

        heroImageMutation.mutate(imageData)
      } catch (error) {
        console.error('Error processing image:', error)
        toast.error('Failed to process image')
        setUploadingHero(false)
      }
    }

    reader.onerror = () => {
      toast.error('Failed to read image file')
      setUploadingHero(false)
    }

    reader.readAsDataURL(file)

    // Reset input
    event.target.value = ''
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
            <input
              type="file"
              ref={heroImageInputRef}
              onChange={handleHeroImageUpload}
              accept="image/*"
              className="hidden"
            />

            <button
              onClick={() => heroImageInputRef.current?.click()}
              disabled={uploadingHero}
              className="btn-secondary flex items-center space-x-2"
              title="Upload Hero Image"
            >
              {uploadingHero ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Image className="w-4 h-4" />
                  <span>Hero Image</span>
                </>
              )}
            </button>

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
                <>
                  {/* Test User Selector Dropdown */}
                  {templateInstance?.test_user_info && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 border border-accent-blue/30 rounded-lg shadow-md">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <Eye className="w-5 h-5 text-accent-blue" />
                          <span className="text-sm font-medium text-primary">Preview as:</span>
                        </div>

                        <div className="flex-1 max-w-md">
                          <select
                            value={selectedTestUserEmail || ''}
                            onChange={(e) => {
                              const email = e.target.value
                              console.log('Selected test user email:', email)
                              setSelectedTestUserEmail(email || null)
                            }}
                            className="w-full bg-dark-primary text-white border-2 border-accent-blue/40 rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-accent-blue transition-all hover:border-accent-blue/60 cursor-pointer"
                            style={{
                              appearance: 'none',
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236366f1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.5rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1.5em 1.5em',
                              paddingRight: '2.5rem',
                            }}
                          >
                            {testUsers?.users?.filter(u => u.active).map(user => (
                              <option
                                key={user.email}
                                value={user.email}
                                style={{
                                  backgroundColor: '#1a1b26',
                                  color: '#ffffff',
                                  padding: '8px'
                                }}
                              >
                                {user.name} ({user.school_code}) - {user.email}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex-shrink-0 bg-dark-secondary/50 rounded-lg px-4 py-2 border border-accent-blue/20">
                          <div className="text-sm text-accent-blue font-semibold">
                            {templateInstance.test_user_info.school_name || templateInstance.test_user_info.school_code}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            Code: {templateInstance.test_user_info.school_code}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-accent-blue/20 text-xs text-muted flex items-center space-x-2">
                        <TestTube className="w-4 h-4 text-accent-purple" />
                        <span>
                          This preview shows <strong className="text-accent-blue">{templateInstance.test_user_info.name}</strong>'s personalized email with their {templateInstance.test_user_info.school_code} products
                        </span>
                      </div>
                    </div>
                  )}
                  <EmailCanvas
                    ref={canvasRef}
                    templateInstance={templateInstance}
                    isLoading={isAIProcessing || testPreviewLoading || !templateInstance}
                  />
                </>
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

                    <div className="col-span-2">
                      <h3 className="text-lg font-semibold text-primary mb-4 mt-4">Call-to-Action Buttons</h3>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Primary Button Text (Shop the Collection)
                      </label>
                      <input
                        type="text"
                        value={templateInstance?.template_config?.CTA_PRIMARY_TEXT || 'Shop the Collection'}
                        onChange={(e) => {
                          const newConfig = { ...templateInstance.template_config, CTA_PRIMARY_TEXT: e.target.value }
                          handleConfigChange(newConfig)
                        }}
                        className="input-dark"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Primary Button Link
                      </label>
                      <input
                        type="text"
                        value={templateInstance?.template_config?.CTA_PRIMARY_LINK || 'https://www.rrinconline.com'}
                        onChange={(e) => {
                          const newConfig = { ...templateInstance.template_config, CTA_PRIMARY_LINK: e.target.value }
                          handleConfigChange(newConfig)
                        }}
                        className="input-dark"
                        placeholder="https://www.example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Secondary Button Text (Team-specific)
                      </label>
                      <input
                        type="text"
                        value={templateInstance?.template_config?.CTA_SECONDARY_TEXT || 'Shop Your Team\'s Collection'}
                        onChange={(e) => {
                          const newConfig = { ...templateInstance.template_config, CTA_SECONDARY_TEXT: e.target.value }
                          handleConfigChange(newConfig)
                        }}
                        className="input-dark"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary mb-2">
                        Secondary Button Link
                        <span className="text-muted text-xs ml-2">(Auto-populated per recipient)</span>
                      </label>
                      <input
                        type="text"
                        value="{{SCHOOL_PAGE}}"
                        disabled
                        className="input-dark opacity-50"
                        title="This link is automatically personalized for each recipient based on their school"
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
