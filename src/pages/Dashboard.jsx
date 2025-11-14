import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { 
  Mail, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Plus,
  Eye,
  Send
} from 'lucide-react'
import { campaignAPI, errorUtils } from '../utils/api'
import LoadingSpinner from '../components/common/LoadingSpinner'

function Dashboard() {
  // Fetch campaigns data
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignAPI.getCampaigns,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  })

  // Fetch email campaign data for statistics
  const { data: emailData, isLoading: emailLoading } = useQuery({
    queryKey: ['email-campaign-data', { limit: 300 }],
    queryFn: () => campaignAPI.getEmailCampaignData({ limit: 300 }),
  })

  const campaigns = campaignsData?.campaigns || []
  const totalEmailRecords = emailData?.total_items || 0  // Use total_items for actual count
  const sourceCounts = emailData?.source_counts || {}

  // Calculate campaign statistics
  const stats = React.useMemo(() => {
    const totalCampaigns = campaigns.length
    const activeCampaigns = campaigns.filter(c => c.status === 'sending').length
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length
    const totalEmailsSent = campaigns.reduce((sum, c) => sum + (c.emails_sent || 0), 0)
    
    return {
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalEmailsSent,
      totalEmailRecords
    }
  }, [campaigns, totalEmailRecords])

  // Recent campaigns (last 5)
  const recentCampaigns = React.useMemo(() => {
    return campaigns
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
  }, [campaigns])

  const StatCard = ({ icon: Icon, label, value, color = 'blue', subtitle = null }) => (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  )

  const CampaignStatusBadge = ({ status }) => {
    const statusConfig = {
      draft: { color: 'gray', text: 'Draft' },
      ready: { color: 'blue', text: 'Ready' },
      sending: { color: 'yellow', text: 'Sending' },
      completed: { color: 'green', text: 'Completed' },
      failed: { color: 'red', text: 'Failed' }
    }
    
    const config = statusConfig[status] || statusConfig.draft
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        {config.text}
      </span>
    )
  }

  if (campaignsLoading || emailLoading) {
    return (
      <LoadingSpinner size="lg" text="Loading dashboard..." className="h-64" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your email campaigns and performance</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Mail}
          label="Total Campaigns"
          value={stats.totalCampaigns}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="Active Campaigns"
          value={stats.activeCampaigns}
          color="yellow"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed Campaigns"
          value={stats.completedCampaigns}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Emails Sent"
          value={stats.totalEmailsSent.toLocaleString()}
          color="purple"
        />
      </div>

      {/* Email Database Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Database Overview</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total Email Records</span>
              <span className="text-lg font-bold text-gray-900">{totalEmailRecords.toLocaleString()}</span>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">By Source</h4>
              {Object.entries(sourceCounts).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600">{source}</span>
                  <span className="font-medium text-gray-900">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
            
            <div className="pt-2 border-t">
              <Link to="/email-data" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View All Email Data →
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Campaigns */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Campaigns</h3>
            <Link to="/campaigns" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View All →
            </Link>
          </div>
          
          {recentCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No campaigns yet</p>
              <Link to="/campaigns/new" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Create your first campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCampaigns.map((campaign) => (
                <div key={campaign.campaign_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {campaign.campaign_name || 'Untitled Campaign'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(campaign.created_at).toLocaleDateString()} • {campaign.total_emails || 0} emails
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <CampaignStatusBadge status={campaign.status} />
                    <Link 
                      to={`/campaigns/${campaign.campaign_id}`}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/campaigns/new" 
            className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">Create Campaign</p>
              <p className="text-sm text-blue-700">Start a new email campaign</p>
            </div>
          </Link>
          
          <Link 
            to="/colleges" 
            className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            <Users className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Manage Colleges</p>
              <p className="text-sm text-green-700">Add or edit college data</p>
            </div>
          </Link>
          
          <Link 
            to="/test-users" 
            className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <Send className="h-5 w-5 text-purple-600" />
            <div>
              <p className="font-medium text-purple-900">Test Users</p>
              <p className="text-sm text-purple-700">Manage test email recipients</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Dashboard