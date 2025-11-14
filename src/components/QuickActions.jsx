import React, { useState } from 'react'
import { Palette, Type, Move, Eye, Zap } from 'lucide-react'

function QuickActions({ onAction, disabled = false }) {
  const [activeCategory, setActiveCategory] = useState('colors')

  const colorOptions = [
    { name: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
    { name: 'Green', value: '#10b981', class: 'bg-green-500' },
    { name: 'Orange', value: '#f59e0b', class: 'bg-orange-500' },
    { name: 'Red', value: '#ef4444', class: 'bg-red-500' },
    { name: 'Purple', value: '#8b5cf6', class: 'bg-purple-500' },
    { name: 'Teal', value: '#14b8a6', class: 'bg-teal-500' }
  ]

  const textActions = [
    { 
      label: 'Make Title Bigger', 
      action: () => onAction('increase_title_size'),
      icon: '📈'
    },
    { 
      label: 'Make Title Smaller', 
      action: () => onAction('decrease_title_size'),
      icon: '📉'
    },
    { 
      label: 'Bold Title', 
      action: () => onAction('bold_title'),
      icon: '🆂'
    },
    { 
      label: 'Center Content', 
      action: () => onAction('center_content'),
      icon: '⚖️'
    }
  ]

  const layoutActions = [
    { 
      label: 'Add Padding', 
      action: () => onAction('add_padding'),
      icon: '📏'
    },
    { 
      label: 'Remove Padding', 
      action: () => onAction('remove_padding'),
      icon: '📐'
    },
    { 
      label: 'Increase Spacing', 
      action: () => onAction('increase_spacing'),
      icon: '📊'
    },
    { 
      label: 'Tighten Layout', 
      action: () => onAction('tighten_layout'),
      icon: '🗜️'
    }
  ]

  const quickTemplates = [
    {
      label: 'Professional',
      action: () => onAction('apply_professional_style'),
      description: 'Clean, corporate look'
    },
    {
      label: 'Modern',
      action: () => onAction('apply_modern_style'),
      description: 'Contemporary design'
    },
    {
      label: 'Playful',
      action: () => onAction('apply_playful_style'),
      description: 'Fun and colorful'
    },
    {
      label: 'Minimalist',
      action: () => onAction('apply_minimal_style'),
      description: 'Simple and clean'
    }
  ]

  const categories = [
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'layout', label: 'Layout', icon: Move },
    { id: 'templates', label: 'Styles', icon: Eye }
  ]

  const handleColorChange = (colorValue, target) => {
    onAction(`change_${target}_color`, { color: colorValue })
  }

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex space-x-1 bg-dark-tertiary rounded-lg p-1">
        {categories.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeCategory === id
                ? 'bg-accent-blue text-white'
                : 'text-secondary hover:text-primary hover:bg-dark-secondary'
            }`}
            disabled={disabled}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Category Content */}
      <div className="space-y-4">
        {activeCategory === 'colors' && (
          <div className="space-y-4">
            {/* Title Colors */}
            <div>
              <h4 className="text-sm font-medium text-secondary mb-3">Title Colors</h4>
              <div className="grid grid-cols-3 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={`title-${color.value}`}
                    onClick={() => handleColorChange(color.value, 'title')}
                    className={`w-full h-10 rounded-lg ${color.class} hover:scale-105 transition-transform relative group`}
                    disabled={disabled}
                    title={`Change title to ${color.name}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {color.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Button Colors */}
            <div>
              <h4 className="text-sm font-medium text-secondary mb-3">Button Colors</h4>
              <div className="grid grid-cols-3 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={`button-${color.value}`}
                    onClick={() => handleColorChange(color.value, 'button')}
                    className={`w-full h-10 rounded-lg ${color.class} hover:scale-105 transition-transform relative group`}
                    disabled={disabled}
                    title={`Change button to ${color.name}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {color.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeCategory === 'text' && (
          <div className="space-y-3">
            {textActions.map((item, index) => (
              <button
                key={index}
                onClick={item.action}
                disabled={disabled}
                className="w-full btn-secondary text-left flex items-center space-x-3 p-3"
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeCategory === 'layout' && (
          <div className="space-y-3">
            {layoutActions.map((item, index) => (
              <button
                key={index}
                onClick={item.action}
                disabled={disabled}
                className="w-full btn-secondary text-left flex items-center space-x-3 p-3"
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {activeCategory === 'templates' && (
          <div className="space-y-3">
            {quickTemplates.map((template, index) => (
              <button
                key={index}
                onClick={template.action}
                disabled={disabled}
                className="w-full btn-secondary text-left p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{template.label}</span>
                  <Zap className="w-4 h-4 text-status-warning" />
                </div>
                <p className="text-sm text-muted mt-1">{template.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Suggestions */}
      <div className="mt-6 p-4 bg-glass rounded-lg border border-glass-border">
        <div className="flex items-center space-x-2 mb-3">
          <Zap className="w-4 h-4 text-status-warning" />
          <h4 className="text-sm font-medium text-primary">AI Suggestions</h4>
        </div>
        <div className="space-y-2 text-sm text-secondary">
          <p>💡 Try "Make the title more prominent"</p>
          <p>💡 Say "Add a hero image placeholder"</p>
          <p>💡 Ask "Can you improve the color scheme?"</p>
        </div>
      </div>
    </div>
  )
}

export default QuickActions