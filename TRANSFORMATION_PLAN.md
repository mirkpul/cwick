# 🔄 Digital Twin → Simple RAG Multitenant - Transformation Plan

## Executive Summary

Transformation of the existing Digital Twin SAAS platform into a simplified RAG (Retrieval-Augmented Generation) multitenant system where users create Knowledge Bases (KB), validate them with benchmarks, and share them via chat interface.

**Project Timeline**: Estimated 3-4 weeks (depending on team size and availability)

---

## 🎯 Transformation Goals

### What We Keep ✅
- All KB data sources (documents, FAQ, web scraping, email integration)
- Complete benchmark/evaluation system
- Conversation system with end_users
- Subscription tiers with usage limits
- Advanced RAG configuration (hybrid search, reranking, etc.)
- Dashboard with tabs structure
- OpenAI + Anthropic LLM providers
- PostgreSQL with pgvector
- React + TypeScript + Tailwind CSS frontend

### What We Add 🆕
- **Gemini (Google AI)** LLM provider
- **OAuth Social Login** (Google, GitHub)
- Simplified KB creation flow

### What We Remove ❌
- Complete handover system (tables, services, WebSocket notifications)
- Digital Twin personality/capabilities/business settings
- OnboardingWizard (multi-step twin creation)
- Professional intervention in conversations

### What We Transform 🔄
- `digital_twins` table → `knowledge_bases` (conceptually)
- `ProfessionalDashboard` → `KBManagementDashboard`
- Routes: `digitalTwinRoutes` → `knowledgeBaseRoutes`
- Services: `digitalTwinService` → `knowledgeBaseService`
- User role: `professional` → `kb_owner`

---

## 📊 Database Schema Transformations

### Migration 1: Transform digital_twins → knowledge_bases

**File**: `database/migrations/010_transform_to_knowledge_base.sql`

```sql
-- Step 1: Rename table
ALTER TABLE digital_twins RENAME TO knowledge_bases;

-- Step 2: Rename columns
ALTER TABLE knowledge_bases RENAME COLUMN twin_id TO kb_id;

-- Step 3: Drop columns (Digital Twin specific)
ALTER TABLE knowledge_bases
  DROP COLUMN IF EXISTS personality_traits,
  DROP COLUMN IF EXISTS communication_style,
  DROP COLUMN IF EXISTS capabilities,
  DROP COLUMN IF EXISTS services,
  DROP COLUMN IF EXISTS pricing_info,
  DROP COLUMN IF EXISTS availability_schedule,
  DROP COLUMN IF EXISTS profession,
  DROP COLUMN IF EXISTS bio;

-- Step 4: Simplify remaining columns
-- Keep: id, user_id, name, avatar_url,
--       llm_provider, llm_model, system_prompt, temperature, max_tokens,
--       semantic_search_threshold, semantic_search_max_results, rag_config,
--       is_active, created_at, updated_at

-- Step 5: Add new columns
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_url VARCHAR(255) UNIQUE;

-- Step 6: Update indexes
DROP INDEX IF EXISTS idx_digital_twins_user_id;
CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX idx_knowledge_bases_share_url ON knowledge_bases(share_url) WHERE share_url IS NOT NULL;

-- Step 7: Update foreign keys
ALTER TABLE knowledge_base RENAME COLUMN twin_id TO kb_id;
ALTER TABLE conversations RENAME COLUMN twin_id TO kb_id;
ALTER TABLE rag_datasets RENAME COLUMN twin_id TO kb_id;
-- etc. for all tables with twin_id foreign key
```

### Migration 2: Remove Handover System

**File**: `database/migrations/011_remove_handover.sql`

```sql
-- Drop handover_notifications table
DROP TABLE IF EXISTS handover_notifications CASCADE;

-- Remove handover columns from conversations
ALTER TABLE conversations
  DROP COLUMN IF EXISTS handed_over_at;

-- Update conversation status enum (remove 'handed_over')
-- Note: In PostgreSQL, need to create new type and migrate
CREATE TYPE conversation_status_new AS ENUM ('active', 'closed');

ALTER TABLE conversations
  ALTER COLUMN status TYPE conversation_status_new
  USING CASE
    WHEN status = 'handed_over' THEN 'active'::conversation_status_new
    ELSE status::text::conversation_status_new
  END;

DROP TYPE conversation_status;
ALTER TYPE conversation_status_new RENAME TO conversation_status;

-- Remove 'professional' from message sender enum
CREATE TYPE message_sender_new AS ENUM ('user', 'assistant');

ALTER TABLE messages
  ALTER COLUMN sender TYPE message_sender_new
  USING CASE
    WHEN sender = 'professional' THEN 'assistant'::message_sender_new
    ELSE sender::text::message_sender_new
  END;

DROP TYPE message_sender;
ALTER TYPE message_sender_new RENAME TO message_sender;
```

### Migration 3: Add OAuth Support

**File**: `database/migrations/012_oauth_support.sql`

```sql
-- Add OAuth columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Make password_hash nullable (for OAuth users)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add unique constraint for OAuth
CREATE UNIQUE INDEX idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;

-- Update role enum to rename 'professional' → 'kb_owner'
CREATE TYPE user_role_new AS ENUM ('super_admin', 'kb_owner', 'end_user');

ALTER TABLE users
  ALTER COLUMN role TYPE user_role_new
  USING CASE
    WHEN role = 'professional' THEN 'kb_owner'::user_role_new
    ELSE role::text::user_role_new
  END;

DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;
```

---

## 🔧 Backend Transformations

### 1. Add Gemini LLM Provider

**Files to modify**:
- `backend/src/services/llmService.ts`
- `backend/src/types/llm.types.ts`
- `backend/package.json` (add `@google/generative-ai`)

**Steps**:
1. Add Gemini SDK dependency: `npm install @google/generative-ai`
2. Update `LLMProvider` type: `'openai' | 'anthropic' | 'gemini'`
3. Add Gemini client initialization in `llmService.ts`
4. Implement Gemini-specific methods:
   - `generateResponseGemini()`
   - `generateStreamingResponseGemini()`
5. Update environment variables: `GEMINI_API_KEY`

**Code snippet** (`backend/src/services/llmService.ts`):
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateResponseGemini(
  messages: any[],
  config: LLMConfig
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: config.model });

  // Convert messages format for Gemini
  const prompt = formatMessagesForGemini(messages);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
    },
  });

  return result.response.text();
}
```

### 2. Add OAuth Social Authentication

**Files to create**:
- `backend/src/services/oauthService.ts`
- `backend/src/routes/oauthRoutes.ts`
- `backend/src/config/oauth.config.ts`

**Dependencies**:
```bash
npm install passport passport-google-oauth20 passport-github2
npm install --save-dev @types/passport @types/passport-google-oauth20 @types/passport-github2
```

**OAuth flow**:
1. User clicks "Login with Google/GitHub"
2. Redirect to OAuth provider
3. Callback receives auth code
4. Exchange code for user info
5. Check if user exists (by `oauth_provider` + `oauth_id`)
6. Create user if new, or login existing
7. Generate JWT token
8. Redirect to dashboard with token

**Routes** (`backend/src/routes/oauthRoutes.ts`):
```typescript
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { session: false }), oauthCallback);

router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/auth/github/callback', passport.authenticate('github', { session: false }), oauthCallback);
```

**Environment variables**:
```env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/google/callback

GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/github/callback
```

### 3. Refactor Routes: digitalTwinRoutes → knowledgeBaseRoutes

**File**: `backend/src/routes/knowledgeBaseRoutes.ts` (rename from `digitalTwinRoutes.ts`)

**Changes**:
- Route base: `/api/digital-twins` → `/api/knowledge-bases`
- Path params: `:twinId` → `:kbId`
- Controller methods: use new `knowledgeBaseService`

**Route mapping**:
```typescript
// OLD → NEW
POST   /api/digital-twins                    → POST   /api/knowledge-bases
GET    /api/digital-twins/me                 → GET    /api/knowledge-bases/me
PUT    /api/digital-twins/:twinId            → PUT    /api/knowledge-bases/:kbId
GET    /api/digital-twins/:twinId/rag-config → GET    /api/knowledge-bases/:kbId/rag-config
POST   /api/digital-twins/:twinId/knowledge  → POST   /api/knowledge-bases/:kbId/knowledge
// etc.
```

### 4. Refactor Services: digitalTwinService → knowledgeBaseService

**File**: `backend/src/services/knowledgeBaseService.ts` (rename from `digitalTwinService.ts`)

**Changes**:
- All function names: `createDigitalTwin()` → `createKnowledgeBase()`
- Database queries: `digital_twins` → `knowledge_bases`
- Remove personality/capabilities logic
- Keep all RAG configuration logic

### 5. Remove Handover System

**Files to delete**:
- `backend/src/services/handoverService.ts` (if exists)
- `backend/src/controllers/handoverController.ts` (if exists)

**Files to modify**:
- `backend/src/services/websocketService.ts` - Remove handover event handlers
- `backend/src/services/chatService.ts` - Remove handover detection and creation
- `backend/src/routes/chatRoutes.ts` - Remove handover endpoints

**WebSocket**: Remove these message types:
- `professional_takeover`
- `handover_notification`

### 6. Update Chat Service

**File**: `backend/src/services/chatService.ts`

**Remove**:
- Handover confidence checking
- `createHandoverNotification()`
- Professional message sending logic

**Keep**:
- RAG retrieval
- LLM response generation
- Conversation management
- Message storage

---

## 🎨 Frontend Transformations

### 1. Add OAuth Login Buttons

**File**: `frontend/src/pages/Login.tsx`

**Add social login section**:
```tsx
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';

const Login = () => {
  const handleOAuthLogin = (provider: 'google' | 'github') => {
    window.location.href = `${API_BASE_URL}/oauth/auth/${provider}`;
  };

  return (
    <div>
      {/* Existing email/password form */}

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleOAuthLogin('google')}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <FcGoogle className="w-5 h-5" />
          Google
        </button>

        <button
          onClick={() => handleOAuthLogin('github')}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <FaGithub className="w-5 h-5" />
          GitHub
        </button>
      </div>
    </div>
  );
};
```

**Create OAuth callback handler**:

**File**: `frontend/src/pages/OAuthCallback.tsx`
```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // Extract token from URL params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=oauth_failed');
      return;
    }

    if (token) {
      // Decode user info from token
      const payload = JSON.parse(atob(token.split('.')[1]));
      login(token, payload.user);
      navigate('/dashboard');
    } else {
      navigate('/login?error=no_token');
    }
  }, [login, navigate]);

  return <div className="flex items-center justify-center min-h-screen">Authenticating...</div>;
};

export default OAuthCallback;
```

**Update routing** in `frontend/src/App.tsx`:
```tsx
<Route path="/oauth/callback" element={<OAuthCallback />} />
```

### 2. Refactor Dashboard: ProfessionalDashboard → KBManagementDashboard

**File**: `frontend/src/pages/KBManagementDashboard.tsx` (rename from `ProfessionalDashboard.tsx`)

**Changes**:
- Component name: `ProfessionalDashboard` → `KBManagementDashboard`
- Remove "Handovers" tab
- Rename tab: "Overview" → "My Knowledge Bases"
- Update all API calls: `digitalTwinAPI` → `knowledgeBaseAPI`
- Rename state variables: `digitalTwin` → `knowledgeBase`, `twinId` → `kbId`

**Tab structure**:
```tsx
const tabs = [
  { id: 'overview', name: 'My Knowledge Bases', icon: DatabaseIcon },
  { id: 'conversations', name: 'Conversations', icon: ChatBubbleLeftRightIcon },
  { id: 'semantic-search', name: 'Semantic Search', icon: MagnifyingGlassIcon },
  { id: 'knowledge-base', name: 'Knowledge Base', icon: BookOpenIcon },
  { id: 'email', name: 'Email Integration', icon: EnvelopeIcon },
  { id: 'benchmark', name: 'Benchmark & Testing', icon: ChartBarIcon },
  { id: 'web-scraping', name: 'Web Sources', icon: GlobeAltIcon },
  { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
];
```

### 3. Replace OnboardingWizard with Simple KB Creation

**Remove file**: `frontend/src/pages/OnboardingWizard.tsx`

**Create new file**: `frontend/src/components/CreateKBModal.tsx`

Simple modal with:
1. KB Name (required)
2. Description (optional)
3. LLM Provider (dropdown: OpenAI/Anthropic/Gemini)
4. LLM Model (dropdown based on provider)
5. Create button

```tsx
const CreateKBModal = ({ isOpen, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    llm_provider: 'openai',
    llm_model: 'gpt-4',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await knowledgeBaseAPI.create(formData);
      onCreate(response.data);
      onClose();
    } catch (error) {
      console.error('Failed to create KB:', error);
    }
  };

  // Form UI...
};
```

### 4. Remove Handover UI Components

**Files to delete or modify**:
- Remove "Handovers" tab from `KBManagementDashboard`
- Remove `HandoverNotification` component (if exists)
- Remove WebSocket handover listeners from chat components

### 5. Update API Service Layer

**File**: `frontend/src/services/api.ts`

**Rename API group**:
```typescript
// OLD
export const digitalTwinAPI = {
  create: (data) => api.post('/api/digital-twins', data),
  getMe: () => api.get('/api/digital-twins/me'),
  update: (twinId, data) => api.put(`/api/digital-twins/${twinId}`, data),
  // ...
};

// NEW
export const knowledgeBaseAPI = {
  create: (data) => api.post('/api/knowledge-bases', data),
  getMe: () => api.get('/api/knowledge-bases/me'),
  update: (kbId, data) => api.put(`/api/knowledge-bases/${kbId}`, data),
  getById: (kbId) => api.get(`/api/knowledge-bases/${kbId}`),
  list: () => api.get('/api/knowledge-bases'),
  delete: (kbId) => api.delete(`/api/knowledge-bases/${kbId}`),

  // Knowledge management
  addKnowledge: (kbId, data) => api.post(`/api/knowledge-bases/${kbId}/knowledge`, data),
  getKnowledge: (kbId) => api.get(`/api/knowledge-bases/${kbId}/knowledge`),
  deleteKnowledge: (kbId, entryId) => api.delete(`/api/knowledge-bases/${kbId}/knowledge/${entryId}`),
  uploadFile: (kbId, formData) => api.post(`/api/knowledge-bases/${kbId}/knowledge/upload`, formData),

  // RAG config
  getRAGConfig: (kbId) => api.get(`/api/knowledge-bases/${kbId}/rag-config`),
  updateRAGConfig: (kbId, config) => api.put(`/api/knowledge-bases/${kbId}/rag-config`, config),

  // Search
  search: (kbId, query) => api.post(`/api/knowledge-bases/${kbId}/knowledge/search`, { query }),
};

// Keep chatAPI, emailAPI, benchmarkAPI, etc. (update references from twinId to kbId)
```

### 6. Update Component Props and State

**Global find and replace across frontend**:
- `digitalTwin` → `knowledgeBase`
- `twinId` → `kbId`
- `twin_id` → `kb_id`
- `DigitalTwin` → `KnowledgeBase` (type names)
- `DIGITAL_TWIN` → `KNOWLEDGE_BASE` (constants)

---

## 📝 Configuration & Environment Updates

### Backend .env

**Add**:
```env
# Gemini LLM
GEMINI_API_KEY=your-gemini-api-key

# OAuth
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/google/callback

GITHUB_OAUTH_CLIENT_ID=your-github-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-github-client-secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/github/callback
```

### Update CLAUDE.md

**File**: `CLAUDE.md`

Update all references:
- "Digital Twin SAAS Platform" → "Simple RAG Multitenant Platform"
- "professionals create digital twins" → "users create knowledge bases"
- Remove mentions of handover, personality, capabilities
- Update routes documentation
- Update database schema documentation

---

## 🧪 Testing Strategy

### Backend Tests to Update

1. **Auth Tests**:
   - Add OAuth flow tests
   - Test Google/GitHub authentication

2. **Knowledge Base Tests**:
   - Rename from `digitalTwin.test.ts` to `knowledgeBase.test.ts`
   - Test CRUD operations
   - Test RAG configuration

3. **Chat Tests**:
   - Remove handover tests
   - Test RAG retrieval with Gemini
   - Test conversation management

4. **Email Integration Tests**:
   - Update references from twinId to kbId

5. **Benchmark Tests**:
   - Update references from twinId to kbId

### Frontend Tests to Update

1. **Dashboard Tests**:
   - Test new `KBManagementDashboard` component
   - Test tab navigation (without Handovers tab)

2. **Auth Tests**:
   - Test OAuth login buttons
   - Test OAuth callback handler

3. **KB Creation Tests**:
   - Test new `CreateKBModal`
   - Remove `OnboardingWizard` tests

---

## 🚀 Deployment Checklist

### Pre-deployment

- [ ] Run all migrations in correct order
- [ ] Update all environment variables
- [ ] Run full test suite (backend + frontend)
- [ ] Test OAuth flow in development
- [ ] Verify Gemini LLM integration
- [ ] Test end-to-end: create KB → add knowledge → chat

### Database Migration

```bash
# Run migrations
psql -U digitaltwin_user -d digitaltwin -f database/migrations/010_transform_to_knowledge_base.sql
psql -U digitaltwin_user -d digitaltwin -f database/migrations/011_remove_handover.sql
psql -U digitaltwin_user -d digitaltwin -f database/migrations/012_oauth_support.sql
```

### Backend Deployment

```bash
cd backend
npm install  # Install new dependencies (Gemini SDK, Passport)
npm run type-check
npm run lint
npm test
npm run build
```

### Frontend Deployment

```bash
cd frontend
npm install  # Install new dependencies (react-icons)
npm run type-check
npm run lint
npm test
npm run build
```

### Docker

Update `docker-compose.yml` with new environment variables, then:

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 📦 Dependencies to Add

### Backend

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.1.3",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-github2": "^0.1.12"
  },
  "devDependencies": {
    "@types/passport": "^1.0.16",
    "@types/passport-google-oauth20": "^2.0.14",
    "@types/passport-github2": "^1.2.9"
  }
}
```

### Frontend

```json
{
  "dependencies": {
    "react-icons": "^5.0.1"
  }
}
```

---

## ⚠️ Breaking Changes

### API Endpoints

All `/api/digital-twins/*` endpoints renamed to `/api/knowledge-bases/*`

**Migration for existing API clients**:
- Update all frontend API calls
- Update any external integrations
- Update documentation

### Database Schema

- `digital_twins` → `knowledge_bases`
- `twin_id` → `kb_id` (foreign keys)
- User role `professional` → `kb_owner`
- Conversation status: removed `handed_over`
- Message sender: removed `professional`

### Authentication

- OAuth users won't have `password_hash`
- New fields: `oauth_provider`, `oauth_id`, `avatar_url`

---

## 🔍 Risk Assessment

### High Risk
- **Database migration**: Renaming tables and columns affects all queries
  - **Mitigation**: Test migrations on staging database first
  - **Rollback**: Keep backup before migration

### Medium Risk
- **OAuth integration**: New authentication flow
  - **Mitigation**: Keep existing email/password auth working
  - **Rollback**: OAuth is additive, can disable if issues

### Low Risk
- **Gemini LLM**: Additional provider
  - **Mitigation**: Falls back to OpenAI/Anthropic if Gemini fails
  - **Rollback**: Easy to remove if not working

---

## 📅 Estimated Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1: Database** | Create and test migrations | 2-3 days |
| **Phase 2: Backend Core** | Refactor services and routes | 3-4 days |
| **Phase 3: Backend Features** | Add Gemini + OAuth | 2-3 days |
| **Phase 4: Frontend Core** | Refactor dashboard and components | 3-4 days |
| **Phase 5: Frontend Features** | OAuth UI + KB creation | 2 days |
| **Phase 6: Testing** | Full system testing | 2-3 days |
| **Phase 7: Documentation** | Update docs and deploy | 1-2 days |

**Total**: ~15-21 days (3-4 weeks)

---

## 📖 Next Steps

1. **Review this plan** with team
2. **Create feature branch**: `git checkout -b feature/transform-to-rag-multitenant`
3. **Start with database migrations** (most critical)
4. **Test each phase** before moving to next
5. **Keep main branch stable** - merge only when tested

---

## 🆘 Support

If you encounter issues during transformation:
1. Check existing tests for examples
2. Review CLAUDE.md for architecture guidance
3. Test in development before staging/production
4. Keep incremental commits for easy rollback

---

**Ready to start transformation?** 🚀

The plan is comprehensive and modular - you can tackle it phase by phase. Start with database migrations, then backend, then frontend.
