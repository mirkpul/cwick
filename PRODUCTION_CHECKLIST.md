# Production Deployment Checklist

## Pre-Deployment

### 1. Environment Variables ✅
- [ ] Copy `.env.example` to `.env.production`
- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (min 32 characters)
- [ ] Generate strong `ENCRYPTION_KEY` (min 32 characters)
- [ ] Configure at least one LLM provider API key:
  - [ ] `OPENAI_API_KEY` (recommended for embeddings)
  - [ ] `ANTHROPIC_API_KEY` (optional)
  - [ ] `GEMINI_API_KEY` (optional)
- [ ] Set production `DATABASE_URL` (with SSL)
- [ ] Set `CORS_ORIGIN` to your production domain
- [ ] Set `FRONTEND_URL` to your production domain
- [ ] Update all OAuth redirect URIs to HTTPS production URLs

### 2. OAuth Configuration
- [ ] Google OAuth:
  - [ ] Update authorized redirect URIs in Google Cloud Console
  - [ ] Set `GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/auth/google/callback`
- [ ] GitHub OAuth:
  - [ ] Update authorization callback URL in GitHub settings
  - [ ] Set `GITHUB_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/auth/github/callback`
- [ ] Gmail Integration:
  - [ ] Update redirect URI in Google Cloud Console
  - [ ] Set `GMAIL_REDIRECT_URI=https://yourdomain.com/api/email/auth/gmail/callback`
- [ ] Outlook Integration:
  - [ ] Update redirect URI in Azure Portal
  - [ ] Set `OUTLOOK_REDIRECT_URI=https://yourdomain.com/api/email/auth/outlook/callback`

### 3. Database
- [ ] PostgreSQL 14+ with pgvector extension installed
- [ ] Run all migrations in order:
  - [ ] `database/init_db.sql`
  - [ ] `database/migrations/001_initial_schema.sql`
  - [ ] Additional migrations as needed
- [ ] Configure database connection pooling
- [ ] Enable SSL for database connections
- [ ] Set up automated backups

### 4. Security
- [ ] Enable HTTPS (SSL/TLS certificates)
- [ ] Configure firewall rules
- [ ] Set up rate limiting (already configured in code)
- [ ] Review and update CORS settings
- [ ] Disable debug logging (`LOG_LEVEL=info` or `LOG_LEVEL=error`)
- [ ] Set `RAG_LOG_VERBOSE=false`
- [ ] Remove all console.log statements from code
- [ ] Enable Helmet security headers (already configured)

### 5. Code Quality
- [ ] All tests passing: `npm test`
- [ ] Test coverage ≥ 49%: `npm run test:coverage`
- [ ] TypeScript compilation successful: `npm run type-check`
- [ ] No ESLint errors: `npm run lint`
- [ ] Build successful (backend): `cd backend && npm run build`
- [ ] Build successful (frontend): `cd frontend && npm run build`

### 6. Infrastructure
- [ ] Redis server running (for web scraping)
- [ ] Sufficient disk space for:
  - Database
  - File uploads (default: 100MB per file)
  - Web scraping screenshots (if enabled)
- [ ] Configure monitoring and alerting
- [ ] Set up log aggregation (CloudWatch, Datadog, etc.)

## Deployment

### 7. Docker Deployment (Recommended)
```bash
# Build production images
docker-compose -f docker-compose.yml build

# Start services
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 8. Manual Deployment
```bash
# Backend
cd backend
npm install --production
npm run build
NODE_ENV=production npm start

# Frontend
cd frontend
npm install
npm run build
# Serve dist/ with Nginx or similar
```

### 9. Verify Deployment
- [ ] Backend health check: `https://yourdomain.com/api/health`
- [ ] Frontend loads correctly: `https://yourdomain.com`
- [ ] Database connection working
- [ ] WebSocket connection working
- [ ] OAuth flows working (Google, GitHub)
- [ ] Email integration working (Gmail, Outlook)
- [ ] File upload working
- [ ] Chat functionality working

## Post-Deployment

### 10. Monitoring
- [ ] Set up uptime monitoring
- [ ] Configure error tracking (Sentry, Rollbar, etc.)
- [ ] Monitor API response times
- [ ] Track LLM API costs and token usage
- [ ] Monitor database performance
- [ ] Set up alerts for:
  - Server down
  - High error rates
  - Database connection issues
  - High LLM costs

### 11. Backups
- [ ] Automated database backups (daily recommended)
- [ ] Backup retention policy configured
- [ ] Test restore procedure
- [ ] Document backup/restore process

### 12. Documentation
- [ ] Update deployment documentation
- [ ] Document rollback procedure
- [ ] Create incident response plan
- [ ] Share production credentials securely with team

## Performance Optimization

### 13. Caching
- [ ] Enable Redis caching for frequently accessed data
- [ ] Configure CDN for static assets (frontend)
- [ ] Enable browser caching headers

### 14. Scaling
- [ ] Configure horizontal scaling if needed
- [ ] Set up load balancer
- [ ] Consider read replicas for database
- [ ] Monitor resource usage (CPU, memory, disk)

## Cost Optimization

### 15. LLM Usage
- [ ] Review RAG configuration for optimal cost/quality:
  - Query enhancement settings (currently optimized)
  - Embedding batch size
  - Context window size
- [ ] Monitor token usage per knowledge base
- [ ] Set up cost alerts for LLM APIs
- [ ] Consider using cheaper models for non-critical tasks

### 16. Storage
- [ ] Configure file upload limits
- [ ] Set up periodic cleanup of old files
- [ ] Compress images and documents
- [ ] Archive old conversations

## Compliance & Legal

### 17. Data Privacy
- [ ] GDPR compliance (if applicable)
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Cookie consent implemented
- [ ] Data retention policy defined
- [ ] User data export functionality

### 18. Security Audits
- [ ] Run security scan (npm audit, Snyk, etc.)
- [ ] Penetration testing completed
- [ ] SQL injection prevention verified
- [ ] XSS protection verified
- [ ] CSRF protection verified

## Emergency Contacts

- **DevOps Lead**: [Name/Contact]
- **Backend Engineer**: [Name/Contact]
- **Database Admin**: [Name/Contact]
- **On-Call Schedule**: [Link]

## Rollback Plan

If deployment fails:
1. Stop new services: `docker-compose down`
2. Restore previous Docker images
3. Revert database migrations if needed
4. Restart previous version: `docker-compose up -d`
5. Notify team and users

## Version Info

- **Version**: 1.0.0
- **Deployment Date**: _____________
- **Deployed By**: _____________
- **Git Commit**: _____________
- **Environment**: Production

---

**Signature**: _________________ **Date**: _____________
