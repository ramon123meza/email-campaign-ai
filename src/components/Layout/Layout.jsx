import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Mail,
  Settings,
  Users,
  Database,
  BarChart3,
  Menu,
  X,
  School,
  FileSpreadsheet,
  TestTube,
  Sparkles
} from 'lucide-react'
import { clsx } from 'clsx'

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Colleges', href: '/colleges', icon: School },
  { name: 'Email Data', href: '/email-data', icon: FileSpreadsheet },
  { name: 'Test Users', href: '/test-users', icon: TestTube },
]

const LOGO_URL = 'https://layout-tool-randr.s3.us-east-1.amazonaws.com/logo_email_campaing.png'

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen">
      {/* Mobile sidebar */}
      <div className={clsx(
        'fixed inset-0 z-50 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />

        <div className="fixed inset-y-0 left-0 z-50 w-72 card-gradient shadow-2xl">
          <div className="flex h-20 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Email Campaign Manager" className="h-12 w-auto" />
              <div>
                <span className="block text-lg font-bold text-gradient">Campaign Manager</span>
                <span className="block text-xs text-gray-500">Powered by AI</span>
              </div>
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="mt-8 px-4">
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                      location.pathname === item.href
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-700 hover:bg-blue-50 hover:shadow-md hover:text-blue-700'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-6 overflow-y-auto card-gradient px-6 pb-4">
          <div className="flex h-20 shrink-0 items-center gap-3 pt-2">
            <img src={LOGO_URL} alt="Email Campaign Manager" className="h-14 w-auto" />
            <div>
              <span className="block text-xl font-bold text-gradient">Campaign Manager</span>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Sparkles className="h-3 w-3 text-gradient-ai" />
                <span>Powered by AI</span>
              </div>
            </div>
          </div>

          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={clsx(
                      'group flex items-center gap-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                      location.pathname === item.href
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-blue-50 hover:shadow-md hover:text-blue-700'
                    )}
                  >
                    <item.icon className={clsx(
                      "h-5 w-5 shrink-0 transition-transform duration-200",
                      location.pathname !== item.href && "group-hover:scale-110"
                    )} />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto p-4 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-200">
            <p className="text-xs text-gray-600 font-medium">✨ AI-Powered Features</p>
            <p className="text-xs text-gray-500 mt-1">Claude Sonnet 4.5 integration active</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-40 card-gradient border-b border-white/30 shadow-lg backdrop-blur-xl">
          <div className="flex h-18 shrink-0 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-gray-700 lg:hidden hover:bg-white/50 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1 items-center">
                <h1 className="text-xl font-bold text-gradient">
                  {navigation.find(item => item.href === location.pathname)?.name || 'Email Campaign Manager'}
                </h1>
              </div>

              <div className="flex items-center gap-x-4 lg:gap-x-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-100 to-cyan-100">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">R&R Imports</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout