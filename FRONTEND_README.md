# Email Campaign Manager - Frontend Application

## 🚀 Quick Start

This directory contains **only** the React frontend application for the Email Campaign Manager.

### 1. Navigate to Frontend Directory
```bash
cd /home/rcardonameza/email-campaign-frontend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
🌐 **App will be available at**: `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
```

## 📁 Clean Directory Structure

This frontend directory contains only React application files:

```
email-campaign-frontend/
├── src/                    # React source code
│   ├── components/         # Reusable components
│   ├── pages/             # Page components
│   ├── config/            # API configuration
│   ├── utils/             # Utility functions
│   └── App.jsx            # Main app component
├── scripts/               # Deployment scripts
├── package.json           # Dependencies
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind CSS config
├── .env                   # Environment variables
└── README files           # Documentation
```

## ✅ What's NOT in this directory

The following files remain in `/home/rcardonameza/email_campain_input_files/`:
- Python campaign scripts (cutting_boards_campaign.py, hats_campaign.py, etc.)
- Lambda function files (lambda_campaign_manager.py, lambda_email_sender.py)
- Database setup files (setup_database.py)
- Sample CSV files (email_list_new_*.csv)
- Original documentation files

## 🔗 Backend Dependencies

The frontend connects to your deployed Lambda functions:
- **Campaign API**: `https://2h7bk75jscgiryp6zt4dh3htsy0aovsr.lambda-url.us-east-1.on.aws`
- **Email API**: `https://myylk2rmfu3njaqfxzwyvmyaru0sgwlv.lambda-url.us-east-1.on.aws`

## 🎯 Ready to Use

Your frontend is completely independent and production-ready:
1. All dependencies are configured
2. Environment variables are set
3. API endpoints are configured
4. Build system is ready
5. Documentation is complete

**Simply run `npm install` and `npm run dev` to start developing!**