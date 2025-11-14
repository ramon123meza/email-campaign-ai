import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, MessageSquare, Trash2 } from 'lucide-react'
import { useEditorContext } from '../context/EditorContext'

function AIChat({ className = '' }) {
  const { chatHistory, onSendMessage, isAIProcessing } = useEditorContext()
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory])

  useEffect(() => {
    if (isAIProcessing) {
      setIsTyping(true)
      const timer = setTimeout(() => setIsTyping(false), 3000)
      return () => clearTimeout(timer)
    } else {
      setIsTyping(false)
    }
  }, [isAIProcessing])

  const handleSend = () => {
    if (!message.trim() || isAIProcessing) return

    onSendMessage(message)
    setMessage('')
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e) => {
    setMessage(e.target.value)
    
    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  const quickActions = [
    { text: 'Change title color', icon: '🎨' },
    { text: 'Make button green', icon: '🟢' },
    { text: 'Update main title', icon: '📝' },
    { text: 'Add more padding', icon: '📏' },
    { text: 'Make text bigger', icon: '🔍' },
    { text: 'Center align content', icon: '⚖️' }
  ]

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = (msg, index) => {
    const isUser = msg.role === 'user'
    const isLatest = index === chatHistory.length - 1

    return (
      <div
        key={index}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-slide-up`}
      >
        <div className={`flex items-start space-x-3 max-w-[85%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          {/* Avatar */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-accent-blue' 
              : 'bg-accent-green'
          }`}>
            {isUser ? (
              <User className="w-4 h-4 text-white" />
            ) : (
              <Bot className="w-4 h-4 text-white" />
            )}
          </div>
          
          {/* Message Content */}
          <div className={`${isUser ? 'message-user' : 'message-assistant'} relative group`}>
            <div className="mb-1">
              {msg.content}
            </div>
            
            {/* Changes indicator for AI responses */}
            {!isUser && msg.changes && msg.changes.length > 0 && (
              <div className="mt-2 p-2 bg-glass rounded border border-glass-border">
                <div className="text-xs text-status-success font-medium mb-1">✅ Changes Applied:</div>
                <ul className="text-xs space-y-1">
                  {msg.changes.map((change, i) => (
                    <li key={i} className="text-secondary">• {change.change}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Timestamp */}
            <div className={`text-xs opacity-0 group-hover:opacity-70 transition-opacity mt-1 ${
              isUser ? 'text-blue-100' : 'text-muted'
            }`}>
              {formatTimestamp(msg.timestamp)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat-container flex flex-col ${className}`}>
      {/* Chat Header */}
      <div className="p-4 border-b border-border-primary bg-dark-secondary">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-accent-green rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary">AI Assistant</h3>
              <p className="text-sm text-secondary">
                {isAIProcessing ? 'Thinking...' : 'Ready to help'}
              </p>
            </div>
          </div>
          
          <button className="btn-secondary p-2" title="Clear Chat">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {chatHistory.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-dark-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-muted" />
            </div>
            <h4 className="text-lg font-medium text-primary mb-2">Start a Conversation</h4>
            <p className="text-secondary mb-6">
              Ask me to modify your email template or get suggestions for improvements.
            </p>
            
            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary mb-3">Try these commands:</p>
              <div className="grid grid-cols-1 gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => setMessage(action.text)}
                    className="quick-action-btn text-left flex items-center space-x-2"
                    disabled={isAIProcessing}
                  >
                    <span>{action.icon}</span>
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {chatHistory.map(renderMessage)}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="flex items-start space-x-3 max-w-[85%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent-green">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="message-assistant">
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span className="text-xs text-muted">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick Actions Bar */}
      {chatHistory.length > 0 && (
        <div className="px-4 py-2 border-t border-border-primary bg-dark-secondary">
          <div className="flex flex-wrap gap-2">
            {quickActions.slice(0, 3).map((action, index) => (
              <button
                key={index}
                onClick={() => setMessage(action.text)}
                className="quick-action-btn text-xs flex items-center space-x-1"
                disabled={isAIProcessing}
              >
                <span>{action.icon}</span>
                <span>{action.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-border-primary bg-dark-secondary">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to modify your email template..."
            disabled={isAIProcessing}
            className="textarea-dark pr-12 resize-none"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          
          <button
            onClick={handleSend}
            disabled={!message.trim() || isAIProcessing}
            className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all ${
              message.trim() && !isAIProcessing
                ? 'bg-accent-blue text-white hover:bg-blue-600 transform hover:scale-105'
                : 'bg-dark-tertiary text-muted cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-muted">
            Press Enter to send, Shift+Enter for new line
          </div>
          
          {isAIProcessing && (
            <div className="flex items-center space-x-2 text-xs text-status-warning">
              <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
              <span>Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIChat