# Feature Specification: Email Knowledge Base Integration

## Overview
Integration with user's email account to create a knowledge base from email content, enabling the Virtual Coach to provide more personalized and context-aware responses.

## Requirements

### 1. Email Provider Support
- **OAuth 2.0**: Gmail and Outlook/Microsoft 365
- **IMAP**: Generic support for any email provider
- **Fallback**: If OAuth not available, use IMAP with credentials

### 2. User Interface Integration
- **Location**: Professional Dashboard
- **Type**: Optional feature
- **Access**: Available post-onboarding

### 3. Email Scope & Content

#### Scope
- **Source**: Inbox only
- **Time Range**: Last 6-12 months (configurable)
- **Limits by Tier**:
  - Free: 1,000 emails max
  - Pro: 5,000 emails max
  - Enterprise: Unlimited

#### Content Included
- Email subject
- Email body (plain text and HTML converted to text)
- PDF and TXT attachments
- Email thread context (replies and forwards)
- Metadata: sender, recipients, date, labels/folders

### 4. Synchronization

#### Modes
- **Manual** (default): User-triggered import/sync
- **Automatic** (optional): Daily sync when enabled

#### Process
- Initial import: Process all emails in scope
- Subsequent syncs: Only new emails since last sync
- Background job: Queue-based processing to avoid blocking

### 5. Privacy & Security

#### Data Protection
- **Sensitive Data Detection**: Automatically detect and redact:
  - Credit card numbers
  - Social Security Numbers
  - Passwords and API keys
  - Other PII patterns
- **Selective Deletion**: Users can remove specific emails from knowledge base
- **Token Storage**: OAuth tokens encrypted in database using AES-256

#### User Controls
- View list of imported emails
- Delete individual emails from knowledge base
- Disconnect email account entirely
- Re-sync on demand

### 6. Data Architecture

#### Database Schema
- **New Table**: `email_knowledge`
  - `id`: UUID primary key
  - `user_id`: Foreign key to users table
  - `email_id`: Unique identifier from email provider
  - `thread_id`: Email thread identifier
  - `subject`: Email subject line
  - `sender_email`: Sender email address
  - `sender_name`: Sender display name
  - `recipients`: JSON array of recipients
  - `sent_at`: Email timestamp
  - `body_text`: Email body content
  - `has_attachments`: Boolean flag
  - `attachment_count`: Number of attachments
  - `labels`: JSON array of labels/folders
  - `embedding`: Vector embedding (pgvector)
  - `created_at`: Import timestamp
  - `updated_at`: Last update timestamp

- **New Table**: `email_credentials`
  - `id`: UUID primary key
  - `user_id`: Foreign key to users table
  - `provider`: Enum (gmail, outlook, imap)
  - `encrypted_access_token`: Encrypted OAuth access token
  - `encrypted_refresh_token`: Encrypted OAuth refresh token
  - `token_expires_at`: Token expiration timestamp
  - `imap_host`: IMAP server host (for IMAP connections)
  - `imap_port`: IMAP server port
  - `encrypted_imap_password`: Encrypted IMAP password (for IMAP)
  - `email_address`: User's email address
  - `auto_sync_enabled`: Boolean for automatic sync
  - `last_sync_at`: Last successful sync timestamp
  - `created_at`: Credential creation timestamp
  - `updated_at`: Last update timestamp

#### Chunking Strategy
- **One email = one chunk**: Each email is stored as a single knowledge base entry
- Preserve full context of email conversation
- Attach metadata for filtering

#### Search Integration
- **Configurable Weight**: Parameter to adjust email relevance vs other documents
- **Default Weight**: 1.0 (equal to documents)
- **Metadata Filtering**: Support filtering by sender, date range, has attachments

### 7. Technical Implementation

#### Services
- `EmailAuthService`: Handle OAuth flows and IMAP authentication
- `EmailSyncService`: Fetch and process emails
- `EmailParserService`: Parse email content and extract metadata
- `SensitiveDataService`: Detect and redact sensitive information
- `EmailEmbeddingService`: Generate embeddings for email content

#### API Endpoints
- `POST /api/email/auth/gmail`: Initiate Gmail OAuth flow
- `POST /api/email/auth/outlook`: Initiate Outlook OAuth flow
- `POST /api/email/auth/imap`: Configure IMAP credentials
- `GET /api/email/auth/callback`: OAuth callback handler
- `POST /api/email/sync`: Trigger manual sync
- `PUT /api/email/auto-sync`: Enable/disable automatic sync
- `GET /api/email/list`: List imported emails
- `DELETE /api/email/:id`: Remove specific email from knowledge base
- `DELETE /api/email/disconnect`: Disconnect email account

#### Background Jobs
- `EmailSyncJob`: Periodic job for automatic syncing
- `EmailProcessingJob`: Process individual emails (parsing, embedding)
- `EmailCleanupJob`: Remove old/deleted emails

### 8. Error Handling

#### Common Scenarios
- **OAuth token expired**: Attempt refresh, notify user if refresh fails
- **Email provider down**: Retry with exponential backoff, log error
- **Storage limit reached**: Stop import, notify user, suggest upgrade
- **Malformed email**: Skip email, log warning, continue processing
- **Attachment too large**: Skip attachment, process email body only

### 9. Success Metrics
- Number of emails successfully imported
- Sync success rate
- User engagement (% of users who enable feature)
- Query hit rate (% of queries that return email results)
- User feedback on email-based responses

### 10. Future Enhancements
- Real-time sync via webhooks (Gmail Push API, Outlook webhooks)
- Support for more email providers (Yahoo, ProtonMail, etc.)
- Email sentiment analysis
- Automatic categorization of emails
- Smart suggestions based on email patterns
- Calendar integration
- Contact extraction and management

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Database schema and migrations
- Email credentials encryption
- OAuth flow for Gmail
- Basic IMAP connector
- Email parsing service

### Phase 2: Sync & Processing (Week 2-3)
- Email sync service
- Sensitive data detection
- Embedding generation
- Background job setup
- Error handling and retries

### Phase 3: API & UI (Week 3-4)
- REST API endpoints
- Dashboard UI components
- Email list view
- Sync controls
- Connection management

### Phase 4: Advanced Features (Week 4-5)
- Outlook OAuth integration
- Automatic sync scheduling
- Configurable search weights
- Performance optimization
- Comprehensive testing

### Phase 5: Polish & Launch (Week 5-6)
- Security audit
- Load testing
- Documentation
- User onboarding flow
- Monitoring and alerts
