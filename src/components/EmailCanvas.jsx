import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useEditorContext } from '../context/EditorContext'
import { RefreshCw, Download, Maximize2, Eye, Monitor, Tablet, Smartphone } from 'lucide-react'
import LoadingSpinner from './common/LoadingSpinner'

const EmailCanvas = forwardRef((props, ref) => {
  const { templateInstance, isLoading } = useEditorContext()
  const [canvasScale, setCanvasScale] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [previewMode, setPreviewMode] = useState('desktop') // desktop, tablet, mobile
  const iframeRef = useRef(null)
  const containerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    refreshCanvas: () => {
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src
      }
    },
    exportHTML: () => {
      return templateInstance?.template_html || ''
    },
    takeScreenshot: async () => {
      // Implementation for screenshot functionality
      return null
    }
  }))

  useEffect(() => {
    if (templateInstance?.template_html && iframeRef.current) {
      const iframe = iframeRef.current
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
      
      // Inject the template HTML
      iframeDoc.open()
      iframeDoc.write(templateInstance.template_html)
      iframeDoc.close()
      
      // Add responsive styles for preview
      const style = iframeDoc.createElement('style')
      style.textContent = `
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background-color: #f5f5f5;
          min-height: 100vh;
        }
        
        /* Preview modes */
        .preview-mobile,
        .preview-tablet,
        .preview-desktop {
          width: 100%;
          margin: 0 auto;
        }

        .preview-mobile {
          max-width: 375px;
        }
        
        .preview-tablet {
          max-width: 768px;
        }
        
        .preview-desktop {
          max-width: 960px;
        }
        
        /* Email content wrapper */
        center > table {
          margin: 0 auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
      `
      iframeDoc.head.appendChild(style)
      
      // Apply preview mode class
      iframeDoc.body.className = `preview-${previewMode}`
    }
  }, [templateInstance, previewMode])

  const handleScaleChange = (newScale) => {
    setCanvasScale(newScale)
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  const downloadHTML = () => {
    if (templateInstance?.template_html) {
      const blob = new Blob([templateInstance.template_html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `email-template-${Date.now()}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const previewModeConfig = {
    mobile: { width: 375, label: 'Mobile', Icon: Smartphone },
    tablet: { width: 768, label: 'Tablet', Icon: Tablet },
    desktop: { width: 960, label: 'Desktop', Icon: Monitor }
  }

  const getPreviewContainerStyle = () => {
    if (previewMode === 'desktop') {
      return { width: '100%', maxWidth: `${previewModeConfig.desktop.width}px` }
    }
    const config = previewModeConfig[previewMode] || previewModeConfig.desktop
    return { width: `${config.width}px`, maxWidth: '100%' }
  }

  if (!templateInstance) {
    return (
      <div className="template-canvas h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-dark-secondary rounded-lg flex items-center justify-center mb-4">
            <Eye className="w-8 h-8 text-muted" />
          </div>
          <h3 className="text-lg font-medium text-primary mb-2">No Template Available</h3>
          <p className="text-secondary">Template instance is loading or not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={`template-canvas h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-dark-primary' : ''}`}
    >
      {/* Canvas Controls */}
      <div className="flex items-center justify-between p-4 bg-dark-secondary border-b border-border-primary">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-primary">Email Preview</h3>
          
          {/* Preview Mode Selector */}
          <div className="flex items-center space-x-1 bg-dark-tertiary rounded-lg p-1">
            {Object.entries(previewModeConfig).map(([mode, config]) => {
              const Icon = config.Icon
              return (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  previewMode === mode
                    ? 'bg-accent-blue text-white'
                    : 'text-secondary hover:text-primary hover:bg-dark-secondary'
                }`}
                title={config.label}
              >
                <Icon className="w-4 h-4 mr-1 inline" />
                {config.label}
              </button>
            )})}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Scale Control */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-secondary">Scale:</span>
            <select
              value={canvasScale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="input-dark text-sm px-2 py-1 w-20"
            >
              <option value={0.5}>50%</option>
              <option value={0.75}>75%</option>
              <option value={1}>100%</option>
              <option value={1.25}>125%</option>
              <option value={1.5}>150%</option>
            </select>
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => iframeRef.current?.contentWindow?.location.reload()}
            className="btn-secondary p-2"
            title="Refresh Preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={downloadHTML}
            className="btn-secondary p-2"
            title="Download HTML"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="btn-secondary p-2"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-auto bg-gray-100">
        {isLoading && (
          <div className="absolute inset-0 bg-dark-primary bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-dark-secondary rounded-lg p-6 shadow-xl">
              <LoadingSpinner size="sm" />
              <p className="text-primary mt-2 text-center">AI is updating your template...</p>
            </div>
          </div>
        )}

        <div 
          className="w-full h-full flex items-start justify-center p-8"
          style={{ 
            transform: `scale(${canvasScale})`,
            transformOrigin: 'top center',
            minHeight: `${100 / canvasScale}%`
          }}
        >
          <div 
            className="bg-white shadow-2xl rounded-lg overflow-hidden w-full"
            style={{ 
              ...getPreviewContainerStyle(),
              transition: 'width 0.2s ease'
            }}
          >
            <iframe
              ref={iframeRef}
              className="canvas-iframe"
              style={{
                width: '100%',
                maxWidth: '100%',
                height: '800px',
                border: 'none',
                display: 'block'
              }}
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-dark-secondary border-t border-border-primary">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-secondary">
              Mode: <span className="text-primary">{previewModeConfig[previewMode].label}</span>
            </span>
            <span className="text-secondary">
              Scale: <span className="text-primary">{Math.round(canvasScale * 100)}%</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {templateInstance?.last_modified && (
              <span className="text-muted text-xs">
                Last updated: {new Date(templateInstance.last_modified).toLocaleTimeString()}
              </span>
            )}
            
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-status-warning animate-pulse' : 'bg-status-success'}`} />
            <span className="text-xs text-secondary">
              {isLoading ? 'Updating...' : 'Ready'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

EmailCanvas.displayName = 'EmailCanvas'

export default EmailCanvas
