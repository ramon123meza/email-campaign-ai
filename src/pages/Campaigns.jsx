import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Mail,
  Users,
  Calendar,
  Filter,
  Search,
  Sparkles
} from 'lucide-react'
import { campaignAPI, errorUtils } from '../utils/api'

function Campaigns() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState(null)
  
  const queryClient = useQueryClient()

  // Fetch campaigns
  const { data: campaignsData, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignAPI.getCampaigns,
    refetchInterval: 10000, // Refetch every 10 seconds for status updates
  })

  // Delete campaign mutation
  const deleteMutation = useMutation({
    mutationFn: campaignAPI.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setShowDeleteModal(false)
      setCampaignToDelete(null)
    }
  })

  const campaigns = campaignsData?.campaigns || []

  // Filter campaigns based on search and status
  const filteredCampaigns = React.useMemo(() => {
    return campaigns.filter(campaign => {
      const campaignName = campaign.campaign_name || 'Untitled Campaign'
      const matchesSearch = campaignName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [campaigns, searchTerm, statusFilter])

  // Status configuration
  const statusConfig = {
    draft: { 
      color: 'gray', 
      bg: 'bg-gray-100', 
      text: 'text-gray-800', 
      icon: Edit,
      label: 'Draft' 
    },
    ready: { 
      color: 'blue', 
      bg: 'bg-blue-100', 
      text: 'text-blue-800', 
      icon: CheckCircle,
      label: 'Ready' 
    },
    sending: { 
      color: 'yellow', 
      bg: 'bg-yellow-100', 
      text: 'text-yellow-800', 
      icon: Clock,
      label: 'Sending' 
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

  const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig.draft
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  const handleDeleteClick = (campaign) => {
    setCampaignToDelete(campaign)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete.campaign_id)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getProgressPercentage = (campaign) => {
    if (campaign.total_emails === 0) return 0
    return Math.round((campaign.emails_sent / campaign.total_emails) * 100)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2 text-gray-600">Loading campaigns...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load campaigns</h3>
        <p className="text-gray-600 mb-4">{errorUtils.getErrorMessage(error)}</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['campaigns'] })}
          className="btn-primary"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-gray-600">Manage and monitor your email campaigns</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input min-w-32"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="sending">Sending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match your filters'}
          </h3>
          <p className="text-gray-600 mb-6">
            {campaigns.length === 0 
              ? 'Create your first email campaign to get started'
              : 'Try adjusting your search or filter criteria'
            }
          </p>
          <Link to="/campaigns/new" className="btn-primary">
            Create New Campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredCampaigns.map((campaign) => (
            <div key={campaign.campaign_id} className="card p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Campaign Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {campaign.campaign_name || 'Untitled Campaign'}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Created {formatDate(campaign.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {campaign.total_emails || 0} recipients
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {campaign.emails_sent || 0} sent
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={campaign.status} />
                  </div>

                  {/* Progress Bar */}
                  {campaign.total_emails > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Email Progress</span>
                        <span className="font-medium text-gray-900">
                          {getProgressPercentage(campaign)}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${getProgressPercentage(campaign)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Campaign Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="ml-1 text-gray-600 capitalize">
                        {campaign.campaign_type || 'Product Collection'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Batches:</span>
                      <span className="ml-1 text-gray-600">
                        {campaign.batch_count || 0}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Last Updated:</span>
                      <span className="ml-1 text-gray-600">
                        {formatDate(campaign.last_updated)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Link
                    to={`/campaigns/${campaign.campaign_id}`}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View Campaign"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  
                  {(campaign.status === 'draft' || campaign.status === 'ready') && (
                    <>
                      <Link
                        to={`/campaigns/${campaign.campaign_id}/editor`}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="AI Template Editor"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/campaigns/${campaign.campaign_id}/edit`}
                        className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Edit Campaign"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                    </>
                  )}
                  
                  <button
                    onClick={() => handleDeleteClick(campaign)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Campaign"
                    disabled={campaign.status === 'sending'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Campaign</h3>
                <p className="text-sm text-gray-600">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete "{campaignToDelete?.campaign_name || 'Untitled Campaign'}"? 
              This will remove all campaign data and cannot be reversed.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn-danger flex items-center gap-2"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <div className="loading-spinner" />}
                Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Campaigns