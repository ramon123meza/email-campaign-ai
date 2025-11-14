import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Upload, FileText, Sparkles } from 'lucide-react'
import { campaignAPI, fileUtils } from '../utils/api'
import { useToast } from '../components/common/Toast'
import FileUpload from '../components/common/FileUpload'
import LoadingSpinner from '../components/common/LoadingSpinner'

function CampaignBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const isEditing = !!id

  const [selectedFile, setSelectedFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('')

  // File upload and processing function
  const uploadAndProcessFile = async (file) => {
    try {
      setIsProcessing(true)
      setProcessingStep('Creating campaign...')

      // 1. Create campaign with temporary name
      const campaignData = {
        name: `Campaign ${new Date().toISOString().split('T')[0]}`,
        template_config: {
          main_title: '',
          main_image_url: '',
          description: '',
          footer_text: 'R and R Imports, Inc',
          company_address: '5271 Lee Hwy, Troutville, VA 24175-7555 USA'
        }
      }

      const createResponse = await campaignAPI.createCampaign(campaignData)
      const campaignId = createResponse.campaign_id

      setProcessingStep('Uploading product file...')
      toast.info('Uploading product file...')

      // 2. Convert file to base64
      const base64Content = await fileUtils.fileToBase64(file)

      // 3. Upload file
      await campaignAPI.uploadFile(campaignId, {
        file_content: base64Content,
        file_name: file.name
      })

      setProcessingStep('Analyzing products with AI...')
      toast.info('AI is analyzing your products to generate campaign content...')

      // 4. Call AI to generate campaign metadata
      try {
        const aiResponse = await campaignAPI.aiGenerateContent(campaignId)

        if (aiResponse && aiResponse.content) {
          // Update campaign with AI-generated content
          const updateData = {
            name: aiResponse.content.campaign_title || campaignData.name,
            template_config: {
              ...campaignData.template_config,
              main_title: aiResponse.content.main_headline || 'New Collection Just Dropped!',
              description: aiResponse.content.description || 'Check out our latest products!',
              subject_line: aiResponse.content.subject_lines?.[0] || 'New Products Available',
              cta_text: aiResponse.content.cta_text || 'Shop Now'
            }
          }

          await campaignAPI.updateCampaign(campaignId, updateData)
          toast.success('AI successfully generated campaign content!')
        }
      } catch (aiError) {
        console.error('AI analysis failed:', aiError)
        toast.error(`AI analysis failed: ${aiError.message}`)
        // Continue anyway - user can manually edit
      }

      setProcessingStep('Processing campaign data...')
      toast.info('Processing campaign and creating email batches...')

      // 5. Process the campaign (create batches)
      await campaignAPI.processCampaign(campaignId)

      toast.success('Campaign created and processed successfully!')
      setProcessingStep('')

      // 6. Navigate to campaign detail page (email editor/preview)
      navigate(`/campaigns/${campaignId}`)

    } catch (error) {
      console.error('Error processing file:', error)
      toast.error(`Processing failed: ${error.message}`)
      setProcessingStep('')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileSelect = (file) => {
    setSelectedFile(file)
    if (file) {
      toast.success(`File "${file.name}" selected`)
      // Automatically start processing
      uploadAndProcessFile(file)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/campaigns')}
          className="p-2 hover:bg-gray-100 rounded-lg"
          disabled={isProcessing}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create New Campaign
          </h1>
          <p className="text-gray-600">
            Upload your product CSV and AI will automatically generate your campaign
          </p>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="card p-8">
        <div className="text-center space-y-6">
          {!isProcessing && !selectedFile && (
            <>
              <div className="flex justify-center">
                <div className="rounded-full bg-blue-100 p-6">
                  <Upload className="h-12 w-12 text-blue-600" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Upload Product File</h3>
                <p className="text-gray-600 mb-6">
                  Our AI will analyze your products and automatically create a personalized campaign
                </p>
              </div>

              <FileUpload
                onFileSelect={handleFileSelect}
                acceptedTypes={['.csv']}
                disabled={isProcessing}
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-2">What happens next:</p>
                    <ul className="space-y-2 text-xs">
                      <li>✓ AI analyzes first 5 products to identify product type</li>
                      <li>✓ Generates campaign name, title, and subject lines</li>
                      <li>✓ Creates personalized email content (without college names)</li>
                      <li>✓ Processes products and matches with customer data</li>
                      <li>✓ Creates email batches ready to send</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700">
                    <p className="font-medium mb-1">CSV File Requirements:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Must contain: Variant SKU, Handle, Title, Variant Price, Image Src</li>
                      <li>• Shopify product export format</li>
                      <li>• System extracts school codes automatically</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {isProcessing && (
            <div className="py-12 space-y-6">
              <LoadingSpinner size="lg" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Processing Your Campaign</h3>
                <p className="text-gray-600 mb-4">{processingStep}</p>
                <div className="max-w-md mx-auto">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="space-y-2 text-sm text-left">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
                        <span className="text-blue-900">Uploading products...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <span className="text-blue-900">AI analyzing product types...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                        <span className="text-blue-900">Generating campaign content...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
                        <span className="text-blue-900">Creating email batches...</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Button */}
      {!isProcessing && (
        <div className="flex justify-start">
          <button
            onClick={() => navigate('/campaigns')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export default CampaignBuilder
