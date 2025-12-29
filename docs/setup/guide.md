# Setup & Quick Start Guide

## What Has Been Built

A complete SAAS platform for professionals to create AI-powered knowledge bases with advanced RAG capabilities:

### ✅ Complete Features
1. **User Authentication** - Register, Login, JWT-based auth, OAuth (Google/GitHub)
2. **Multi-Provider LLM Support** - OpenAI (GPT-4, GPT-3.5), Anthropic (Claude 3.x), Google (Gemini)
3. **Advanced RAG Engine** - Hybrid search, query enhancement, reranking, ensemble balancing
4. **Multi-Source Knowledge** - Documents (PDF, DOCX, PPTX), Email sync (Gmail/Outlook/IMAP), Web scraping
5. **Real-time Chat** - WebSocket-based conversations with streaming responses
6. **Context Preview** - Inspect AI context before generating responses
7. **Knowledge Base Management** - Add/manage documents, FAQs, and information
8. **Conversation Tracking** - View all chats and analytics
9. **Analytics & Monitoring** - RAG logging, token tracking
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

### Step 4: Create Your First Knowledge Base

1. Go to http://localhost:3000
2. Click "Get Started" → Register
3. Complete the onboarding:
   - Basic info (name, email)
   - Create knowledge base
   - Configure LLM provider (OpenAI, Anthropic, or Google)
   - Adjust RAG settings

4. Add knowledge to your KB:
   - Upload documents (PDF, DOCX, TXT, etc.)
   - Connect email (Gmail/Outlook/IMAP)
   - Add web scraping sources
   - Create manual FAQ entries

5. Get your chat widget URL from the dashboard
6. Test it: http://localhost:3000/chat/{your-kb-id}

## Testing the Platform

### Test as End-User
1. Go to the chat URL from your dashboard
2. Enter your name
3. Chat with your knowledge base AI
4. Ask questions to test RAG retrieval

### Test Context Preview
1. Open chat interface
2. Click "Preview Context" before sending message
3. View what documents/emails the AI will use
4. Adjust RAG thresholds if needed

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
