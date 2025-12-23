# Setup & Quick Start Guide

## What Has Been Built

A complete SAAS platform for professionals to create AI-powered digital twins with:

### ✅ Complete Features
1. **User Authentication** - Register, Login, JWT-based auth
2. **Onboarding Wizard** - 6-step comprehensive setup
3. **Multi-Provider AI** - OpenAI (GPT-4) and Anthropic (Claude) support
4. **Webchat Widget** - Beautiful chat interface for end-users
5. **Live Handover** - Real-time WebSocket-based chat takeover
6. **Professional Dashboard** - Limited management panel
7. **Super Admin Dashboard** - Full platform control
8. **Knowledge Base** - Add/manage FAQs and information
9. **Conversation Tracking** - View all chats and analytics
10. **Docker Setup** - Complete containerized environment
11. **CI/CD Pipeline** - Automated testing, validation, and code review workflows

## Getting Started in 5 Minutes

### Step 1: Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
JWT_SECRET=change-this-to-a-secure-random-string
```

### Step 2: Start Everything with Docker

```bash
docker-compose up --build
```

This starts:
- ✅ PostgreSQL database
- ✅ Express backend with WebSocket
- ✅ React frontend
- ✅ Nginx reverse proxy

### Step 3: Access the Application

Open your browser:
- **Main App**: http://localhost:3000
- **API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Step 4: Create Your First Digital Twin

1. Go to http://localhost:3000
2. Click "Get Started" → Register
3. Complete the 6-step onboarding wizard:
   - Basic info (name, profession, bio)
   - AI config (choose OpenAI or Claude)
   - Personality traits
   - Capabilities
   - Services & pricing
   - Knowledge base

4. Get your chat widget URL from the dashboard
5. Test it: http://localhost:3000/chat/{your-twin-id}

## Testing the Platform

### Test as End-User
1. Go to the chat URL from your dashboard
2. Enter your name
3. Chat with your digital twin
4. Ask complex questions to trigger handover

### Test Live Handover
1. Open chat in one browser window
2. Open dashboard in another
3. When handover triggers, click "Take Over" in dashboard
4. Send messages as professional

### Test as Super Admin
1. Login with super admin credentials
2. Access: http://localhost:3000/admin
3. View platform-wide statistics

## Common Commands

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Stop Everything
```bash
docker-compose down
```

### Reset Database
```bash
docker-compose down -v  # Remove volumes
docker-compose up --build
```

### Run Without Docker (Local Development)

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Troubleshooting

### Database Connection Issues
```bash
docker-compose logs postgres
# Wait for "database system is ready to accept connections"
```

If you reset the DB with `docker compose down -v`, the bootstrap SQL in `database/initdb/` is applied on first startup.

### Port Already in Use
```bash
# Change ports in docker-compose.yml
# Or stop conflicting services:
lsof -ti:3000 -ti:3001 -ti:5432 | xargs kill
```
