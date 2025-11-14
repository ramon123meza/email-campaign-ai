import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Mail, User, TestTube } from 'lucide-react'
import { campaignAPI, errorUtils } from '../utils/api'

function TestUsers() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    school_code: '',
    active: true
  })
  
  const queryClient = useQueryClient()

  // Fetch test users
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['test-users'],
    queryFn: campaignAPI.getTestUsers,
  })

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: campaignAPI.createTestUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-users'] })
      handleCloseModal()
    }
  })

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: campaignAPI.deleteTestUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-users'] })
    }
  })

  const users = usersData?.users || []

  const handleAddNew = () => {
    setNewUser({
      email: '',
      name: '',
      school_code: '',
      active: true
    })
    setShowAddModal(true)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setNewUser({
      email: '',
      name: '',
      school_code: '',
      active: true
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    createMutation.mutate(newUser)
  }

  const handleDelete = (email) => {
    if (confirm('Are you sure you want to delete this test user?')) {
      deleteMutation.mutate(email)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner"></div>
        <span className="ml-2">Loading test users...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <TestTube className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load test users</h3>
        <p className="text-gray-600">{errorUtils.getErrorMessage(error)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Users</h1>
          <p className="text-gray-600">Manage email addresses for testing campaigns</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Test User
        </button>
      </div>

      {/* Info Banner */}
      <div className="card p-4 border-l-4 border-blue-500 bg-blue-50">
        <div className="flex items-center gap-2">
          <TestTube className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-blue-900">About Test Users</h3>
            <p className="text-sm text-blue-700">
              Test users receive preview emails when you click "Send Test" on campaigns. 
              Use this to verify templates and content before sending to production users.
            </p>
          </div>
        </div>
      </div>

      {/* Test Users List */}
      {users.length === 0 ? (
        <div className="text-center py-12">
          <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No test users added yet</h3>
          <p className="text-gray-600 mb-6">
            Add test email addresses to preview your campaigns before sending to customers.
          </p>
          <button onClick={handleAddNew} className="btn-primary">
            Add First Test User
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">
                            Added {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">{user.email}</div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {user.school_code || 'N/A'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.active 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(user.email)}
                        className="text-red-400 hover:text-red-600"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Test User</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="John Doe"
                  required
                />
              </div>
              
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  className="input"
                  placeholder="john@example.com"
                  required
                />
              </div>
              
              <div>
                <label className="label">School Code (Optional)</label>
                <input
                  type="text"
                  value={newUser.school_code}
                  onChange={(e) => setNewUser(prev => ({ ...prev, school_code: e.target.value.toUpperCase() }))}
                  className="input"
                  placeholder="e.g., UCLA"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used to test school-specific product recommendations
                </p>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={newUser.active}
                  onChange={(e) => setNewUser(prev => ({ ...prev, active: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                  Active (receives test emails)
                </label>
              </div>
              
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {createMutation.isPending && <div className="loading-spinner" />}
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestUsers