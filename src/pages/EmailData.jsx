import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, Users, Store, Mail, ChevronLeft, ChevronRight } from 'lucide-react'
import { campaignAPI, errorUtils } from '../utils/api'

function EmailData() {
  const [searchTerm, setSearchTerm] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(300)  // Set to 300 emails per page as requested
  const [lastKey, setLastKey] = useState(null)

  // Fetch email data with pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['email-campaign-data', { limit, page: currentPage, last_key: lastKey, search: searchTerm, source: sourceFilter }],
    queryFn: () => {
      const params = { limit, page: currentPage }
      if (lastKey) params.last_key = lastKey
      if (searchTerm) params.search = searchTerm
      if (sourceFilter !== 'all') params.source = sourceFilter
      return campaignAPI.getEmailCampaignData(params)
    },
  })

  const emailData = data?.items || []
  const sourceCounts = data?.source_counts || {}
  const totalItems = data?.total_items || 0
  const totalPages = data?.total_pages || 1
  const hasNextPage = data?.has_more || false

  // Handle pagination
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      setLastKey(null) // Reset for previous page
    }
  }

  const handleNextPage = () => {
    if (hasNextPage && data?.next_key) {
      setCurrentPage(currentPage + 1)
      setLastKey(data.next_key) // Use the next_key from current response
    }
  }

  // Filter data locally as well
  const filteredData = React.useMemo(() => {
    return emailData.filter(record => {
      const matchesSearch = searchTerm === '' || 
        record.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.school_code?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesSource = sourceFilter === 'all' || record.source === sourceFilter
      
      return matchesSearch && matchesSource
    })
  }, [emailData, searchTerm, sourceFilter])

  const totalSourceCount = totalItems || Object.values(sourceCounts).reduce((sum, count) => sum + count, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2">Loading email data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Mail className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load email data</h3>
        <p className="text-gray-600">{errorUtils.getErrorMessage(error)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Campaign Data</h1>
        <p className="text-gray-600">Customer database from Shopify and Etsy orders</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-bold text-gray-900">{totalSourceCount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 bg-green-100 rounded-lg">
              <Store className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Shopify Orders</p>
              <p className="text-2xl font-bold text-gray-900">{(sourceCounts.Shopify || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 bg-purple-100 rounded-lg">
              <Store className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Etsy Orders</p>
              <p className="text-2xl font-bold text-gray-900">{(sourceCounts.Etsy || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email, name, or school code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          {/* Source filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input min-w-32"
            >
              <option value="all">All Sources</option>
              <option value="Shopify">Shopify</option>
              <option value="Etsy">Etsy</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  School
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No data found</h3>
                    <p className="text-gray-600">
                      {emailData.length === 0 ? 'No email records available' : 'No records match your search criteria'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredData.map((record, index) => (
                  <tr key={`${record.customer_email}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {record.customer_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">
                        {record.customer_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {record.school_code || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.source === 'Shopify' 
                          ? 'bg-green-100 text-green-800'
                          : record.source === 'Etsy'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {record.source || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredData.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {filteredData.length} of {limit} records per page
              <br />
              Page {currentPage} of {totalPages} • {totalItems.toLocaleString()} total emails
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <span className="px-3 py-1 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={handleNextPage}
                disabled={!hasNextPage}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmailData