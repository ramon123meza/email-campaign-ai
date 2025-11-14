#!/usr/bin/env node

/**
 * Production Deployment Script
 * Builds and prepares the Email Campaign Manager for deployment
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

console.log('🚀 Starting Email Campaign Manager deployment...\n')

// Check if .env file exists
if (!fs.existsSync(path.join(rootDir, '.env'))) {
  console.log('⚠️  No .env file found. Creating from .env.example...')
  try {
    fs.copyFileSync(
      path.join(rootDir, '.env.example'),
      path.join(rootDir, '.env')
    )
    console.log('✅ Created .env file. Please update it with your API endpoints.\n')
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message)
    process.exit(1)
  }
}

try {
  // Install dependencies
  console.log('📦 Installing dependencies...')
  execSync('npm install', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Dependencies installed\n')

  // Run linting
  console.log('🔍 Running ESLint...')
  try {
    execSync('npm run lint', { cwd: rootDir, stdio: 'inherit' })
    console.log('✅ Linting passed\n')
  } catch (error) {
    console.log('⚠️  Linting warnings found, continuing...\n')
  }

  // Build for production
  console.log('🏗️  Building for production...')
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Production build completed\n')

  // Verify build output
  const distDir = path.join(rootDir, 'dist')
  if (!fs.existsSync(distDir)) {
    throw new Error('Build output directory not found')
  }

  const buildSize = execSync('du -sh dist', { cwd: rootDir, encoding: 'utf8' })
  console.log(`📊 Build size: ${buildSize.trim()}\n`)

  // Check for critical files
  const criticalFiles = ['index.html', 'assets']
  for (const file of criticalFiles) {
    if (!fs.existsSync(path.join(distDir, file))) {
      throw new Error(`Critical file missing: ${file}`)
    }
  }

  console.log('✅ Build verification passed\n')

  // Display deployment instructions
  console.log('🎉 Deployment ready!\n')
  console.log('📋 Next steps:')
  console.log('1. Upload the contents of the "dist" folder to your web server')
  console.log('2. Configure your web server to serve index.html for all routes (SPA mode)')
  console.log('3. Ensure your Lambda functions are deployed and accessible')
  console.log('4. Test the application in production\n')

  console.log('🌐 Deployment options:')
  console.log('• Netlify: npx netlify-cli deploy --prod --dir=dist')
  console.log('• Vercel: npx vercel --prod')
  console.log('• AWS S3: aws s3 sync dist/ s3://your-bucket-name --delete')
  console.log('• Manual: Upload dist/ contents to your web server\n')

  console.log('🔗 Important URLs to verify:')
  console.log(`• Campaign API: ${process.env.VITE_CAMPAIGN_API_URL || 'Configure in .env'}`)
  console.log(`• Email API: ${process.env.VITE_EMAIL_API_URL || 'Configure in .env'}\n`)

} catch (error) {
  console.error('❌ Deployment failed:', error.message)
  process.exit(1)
}