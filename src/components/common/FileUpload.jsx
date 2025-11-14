import React, { useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { clsx } from 'clsx'
import { fileUtils } from '../../utils/api'

const FileUpload = ({ 
  onFileSelect, 
  acceptedTypes = ['.csv'], 
  maxSize = 10 * 1024 * 1024, // 10MB
  className = '',
  disabled = false 
}) => {
  const [uploadError, setUploadError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  const onDrop = (acceptedFiles, rejectedFiles) => {
    setUploadError('')
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors.some(e => e.code === 'file-too-large')) {
        setUploadError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`)
      } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
        setUploadError(`File type not supported. Please upload: ${acceptedTypes.join(', ')}`)
      } else {
        setUploadError('File upload failed')
      }
      return
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      
      // Additional validation
      const errors = fileUtils.validateFile(file)
      if (errors.length > 0) {
        setUploadError(errors[0])
        return
      }

      setSelectedFile(file)
      onFileSelect(file)
    }
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxSize,
    multiple: false,
    disabled
  })

  const removeFile = () => {
    setSelectedFile(null)
    setUploadError('')
    onFileSelect(null)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={className}>
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive && !isDragReject && 'border-blue-400 bg-blue-50',
            isDragReject && 'border-red-400 bg-red-50',
            !isDragActive && !uploadError && 'border-gray-300 hover:border-gray-400',
            uploadError && 'border-red-300 bg-red-50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center">
            <div className={clsx(
              'w-12 h-12 rounded-full flex items-center justify-center mb-3',
              isDragActive && !isDragReject ? 'bg-blue-100' :
              isDragReject || uploadError ? 'bg-red-100' : 'bg-gray-100'
            )}>
              <Upload className={clsx(
                'h-6 w-6',
                isDragActive && !isDragReject ? 'text-blue-600' :
                isDragReject || uploadError ? 'text-red-600' : 'text-gray-400'
              )} />
            </div>
            
            <div className="space-y-1">
              {isDragActive ? (
                <p className="text-sm font-medium text-blue-600">
                  {isDragReject ? 'File type not supported' : 'Drop file here...'}
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    CSV files only, up to {maxSize / 1024 / 1024}MB
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatFileSize(selectedFile.size)} • Ready to upload
              </p>
            </div>
            <button
              onClick={removeFile}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  )
}

export default FileUpload