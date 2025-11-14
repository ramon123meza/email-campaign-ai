import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import Layout from './components/Layout/Layout'
import ErrorBoundary from './components/common/ErrorBoundary'
import { ToastProvider } from './components/common/Toast'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import CampaignBuilder from './pages/CampaignBuilder'
import CampaignDetail from './pages/CampaignDetail'
import CampaignEditor from './pages/CampaignEditor'
import CollegeManager from './pages/CollegeManager'
import EmailData from './pages/EmailData'
import TestUsers from './pages/TestUsers'
import { validateApiConfig } from './config/api'
import './styles/dark-theme.css'

function App() {
  // Check API configuration on app load
  React.useEffect(() => {
    const errors = validateApiConfig();
    if (errors.length > 0) {
      console.warn('API Configuration Issues:', errors);
    } else {
      console.log('✅ API Configuration validated successfully');
    }
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <DndProvider backend={HTML5Backend}>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/new" element={<CampaignBuilder />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/campaigns/:id/edit" element={<CampaignEditor />} />
              <Route path="/campaigns/:id/editor" element={<CampaignEditor />} />
              <Route path="/colleges" element={<CollegeManager />} />
              <Route path="/email-data" element={<EmailData />} />
              <Route path="/test-users" element={<TestUsers />} />
            </Routes>
          </Layout>
        </DndProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App