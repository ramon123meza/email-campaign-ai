import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Search, Image, ExternalLink } from 'lucide-react'
import { campaignAPI, errorUtils } from '../utils/api'

function CollegeManager() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCollege, setEditingCollege] = useState(null)
  const [newCollege, setNewCollege] = useState({
    school_code: '',
    school_name: '',
    school_page: '',
    school_logo: ''
  })
  
  const queryClient = useQueryClient()

  // Fetch colleges
  const { data: collegesData, isLoading, error } = useQuery({
    queryKey: ['colleges'],
    queryFn: campaignAPI.getColleges,
  })

  // Create/Update college mutation
  const saveMutation = useMutation({
    mutationFn: (college) => {
      if (editingCollege) {
        return campaignAPI.updateCollege(college.school_code, college)
      } else {
        return campaignAPI.createCollege(college)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      handleCloseModal()
    }
  })

  // Delete college mutation
  const deleteMutation = useMutation({
    mutationFn: campaignAPI.deleteCollege,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
    }
  })

  const colleges = collegesData?.colleges || []

  // Filter colleges based on search
  const filteredColleges = colleges.filter(college => 
    college.school_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    college.school_code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddNew = () => {
    setEditingCollege(null)
    setNewCollege({
      school_code: '',
      school_name: '',
      school_page: '',
      school_logo: ''
    })
    setShowAddModal(true)
  }

  const handleEdit = (college) => {
    setEditingCollege(college)
    setNewCollege(college)
    setShowAddModal(true)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingCollege(null)
    setNewCollege({
      school_code: '',
      school_name: '',
      school_page: '',
      school_logo: ''
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    saveMutation.mutate(newCollege)
  }

  const handleDelete = (schoolCode) => {
    if (confirm('Are you sure you want to delete this college?')) {
      deleteMutation.mutate(schoolCode)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2">Loading colleges...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">College Database</h1>
          <p className="text-gray-600">Manage school information and logos</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add College
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search colleges..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Colleges Grid */}
      {filteredColleges.length === 0 ? (
        <div className="text-center py-12">
          <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {colleges.length === 0 ? 'No colleges added yet' : 'No colleges match your search'}
          </h3>
          <button onClick={handleAddNew} className="btn-primary">
            Add First College
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredColleges.map((college) => (
            <div key={college.school_code} className="card p-6">
              <div className="flex items-start gap-4">
                {/* Logo */}
                <div className="flex-shrink-0">
                  {college.school_logo ? (
                    <img
                      src={college.school_logo}
                      alt={college.school_name}
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center ${college.school_logo ? 'hidden' : 'flex'}`}
                  >
                    <Image className="h-6 w-6 text-gray-400" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {college.school_name}
                  </h3>
                  <p className="text-sm text-gray-600 font-mono">
                    {college.school_code}
                  </p>
                  {college.school_page && (
                    <a
                      href={college.school_page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Page
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleEdit(college)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(college.school_code)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingCollege ? 'Edit College' : 'Add New College'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">School Code</label>
                <input
                  type="text"
                  value={newCollege.school_code}
                  onChange={(e) => setNewCollege(prev => ({ ...prev, school_code: e.target.value.toUpperCase() }))}
                  className="input"
                  placeholder="e.g., UCLA"
                  required
                  disabled={!!editingCollege}
                />
              </div>
              
              <div>
                <label className="label">School Name</label>
                <input
                  type="text"
                  value={newCollege.school_name}
                  onChange={(e) => setNewCollege(prev => ({ ...prev, school_name: e.target.value }))}
                  className="input"
                  placeholder="e.g., University of California, Los Angeles"
                  required
                />
              </div>
              
              <div>
                <label className="label">School Page URL</label>
                <input
                  type="url"
                  value={newCollege.school_page}
                  onChange={(e) => setNewCollege(prev => ({ ...prev, school_page: e.target.value }))}
                  className="input"
                  placeholder="https://www.rrinconline.com/collections/ucla"
                />
              </div>
              
              <div>
                <label className="label">School Logo URL</label>
                <input
                  type="url"
                  value={newCollege.school_logo}
                  onChange={(e) => setNewCollege(prev => ({ ...prev, school_logo: e.target.value }))}
                  className="input"
                  placeholder="https://example.com/logo.jpg"
                />
              </div>
              
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary"
                >
                  {saveMutation.isPending ? 'Saving...' : (editingCollege ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CollegeManager