# Docker Logs Guide

## Quick Reference

### Vedere i log del backend
```bash
# Logs in tempo reale (follow)
docker logs -f digitaltwin-backend

# Ultimi 100 log
docker logs --tail 100 digitaltwin-backend

# Logs con timestamp
docker logs -t digitaltwin-backend

# Logs da una data specifica
docker logs --since 2025-12-01T10:00:00 digitaltwin-backend
```

### Vedere solo log debug
```bash
docker logs -f digitaltwin-backend | grep "debug"
```

### Vedere KB queries
```bash
docker logs -f digitaltwin-backend | grep "KNOWLEDGE BASE QUERY"
```

### Vedere prompt completi
```bash
docker logs -f digitaltwin-backend | grep "COMPLETE PROMPT TO LLM"
```

### Vedere risposte LLM
```bash
docker logs -f digitaltwin-backend | grep "COMPLETE LLM RESPONSE"
```

---

## Configurazione Log Level

### Metodo 1: Via docker-compose.yml (Persistente)

File già configurato con:
```yaml
environment:
  LOG_LEVEL: ${LOG_LEVEL:-debug}  # Default: debug
```

Per cambiare:
```bash
# Nel file .env nella root del progetto
LOG_LEVEL=info  # Oppure: debug, warn, error
```

Poi restart:
```bash
docker-compose restart backend
```

### Metodo 2: Override temporaneo

```bash
# Solo per questa sessione
LOG_LEVEL=debug docker-compose up backend
```

### Metodo 3: Modifica docker-compose direttamente

```yaml
environment:
  LOG_LEVEL: debug  # Hardcoded
```

---

## Formato Log Output

### Log Normali (info, warn, error)
```
2025-12-01T10:30:45.123Z info: Server started on port 3001
```

### Log Debug - KB Query Results
```
2025-12-01T10:30:46.456Z debug: === KNOWLEDGE BASE QUERY RESULTS ===
  Query: "Come posso contattare il supporto?"
  Results: 2
    1. Support Information - Part 1 (similarity: 0.9234)
       Per contattare il supporto tecnico puoi utilizzare...
    2. Contact Methods (similarity: 0.8891)
       Metodi di contatto alternativi includono...
```

### Log Debug - Prompt to LLM
```
2025-12-01T10:30:47.789Z debug: === COMPLETE PROMPT TO LLM ===
  Provider: openai
  Model: gpt-4
  Temperature: 0.7
  Max Tokens: 1000
  System Prompt Length: 4567 chars
  Messages: 3
  --- System Prompt (first 500 chars) ---
  ## CRITICAL - ANTI-HALLUCINATION INSTRUCTIONS

  You are a digital twin...
  --- Conversation Messages ---
    [user]: Come posso contattare il supporto tecnico?
    [assistant]: Puoi contattare il supporto via email...
    [user]: Quali sono gli orari?
```

### Log Debug - LLM Response
```
2025-12-01T10:30:52.123Z debug: === COMPLETE LLM RESPONSE ===
  Provider: openai
  Model: gpt-4
  Response Length: 287 chars
  Tokens Used: 1390
  Finish Reason: stop
  --- Full Response ---
  Il supporto tecnico è disponibile dal lunedì al venerdì...
```

---

## Troubleshooting

### Problema: Non vedo NESSUN log

**Check 1: Container è running?**
```bash
docker ps | grep backend
```

**Check 2: Vedi almeno log di startup?**
```bash
docker logs digitaltwin-backend | head -20
```

Se non vedi nulla:
```bash
# Restart container
docker-compose restart backend

# O rebuild se hai cambiato Dockerfile
docker-compose up --build backend
```

---

### Problema: Vedo log ma NON quelli debug

**Check: LOG_LEVEL setting**
```bash
# Verifica variabile env nel container
docker exec digitaltwin-backend printenv | grep LOG_LEVEL
```

Se vuoto o "info":
```bash
# Set in .env
echo "LOG_LEVEL=debug" >> .env

# Restart
docker-compose restart backend
```

---

### Problema: Log troppo verbosi

**Riduci log level:**
```bash
# In .env
LOG_LEVEL=info  # Solo info, warn, error

# Restart
docker-compose restart backend
```

---

### Problema: Log troncati o formattati male

Docker ha limiti sul buffer di log. Se i log JSON sono troppo grandi, potrebbero essere troncati.

**Soluzione:** Il nuovo formatter riduce la verbosità:
- System prompt: Mostra solo primi 500 caratteri
- Messages: Mostra preview
- Response: Mostra completa

Se serve il prompt completo, controlla i file log:
```bash
docker exec digitaltwin-backend cat logs/combined.log | tail -100
```

---

## Best Practices Docker Logging

### 1. Follow Logs durante Development

```bash
# Terminal 1: Backend logs
docker logs -f digitaltwin-backend

# Terminal 2: Database logs
docker logs -f digitaltwin-db

# Terminal 3: Frontend logs
docker logs -f digitaltwin-frontend
```

### 2. Filtra per Conversazione Specifica

```bash
# Trova conversation ID
docker logs digitaltwin-backend | grep "conversationId"

# Segui quella conversazione
docker logs -f digitaltwin-backend | grep "conv-abc123"
```

### 3. Salva Log per Analisi

```bash
# Salva ultimi 1000 log
docker logs --tail 1000 digitaltwin-backend > backend-logs.txt

# Salva tutto da una data
docker logs --since 2025-12-01 digitaltwin-backend > debug-session.txt
```

### 4. Monitor Performance

```bash
# Count requests per minute
docker logs digitaltwin-backend |
  grep "LLM Response" |
  awk '{print $1}' |
  uniq -c

# Average response length
docker logs digitaltwin-backend |
  grep "Response Length" |
  grep -oP 'Response Length: \K[0-9]+' |
  awk '{sum+=$1; count++} END {print "Avg:", sum/count}'
```

---

## Docker Compose Logs

### Tutti i servizi insieme
```bash
docker-compose logs -f
```

### Solo backend
```bash
docker-compose logs -f backend
```

### Con timestamp
```bash
docker-compose logs -t -f backend
```

### Ultimi N righe
```bash
docker-compose logs --tail 50 backend
```

---

## Log Persistenti

I log vengono salvati anche su file nel container:
- `logs/error.log` - Solo errori
- `logs/combined.log` - Tutti i log

### Accedere ai file log
```bash
# Via exec
docker exec digitaltwin-backend cat logs/combined.log

# Via volume mount (se configurato)
cat backend/logs/combined.log

# Via copy
docker cp digitaltwin-backend:/app/logs/combined.log ./local-logs.txt
```

---

## Integrazione con Tools

### Logstash/Elasticsearch
```yaml
# docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Datadog
```yaml
# docker-compose.yml
environment:
  DD_API_KEY: ${DD_API_KEY}
  DD_LOGS_ENABLED: true
```

### CloudWatch (AWS)
```yaml
logging:
  driver: "awslogs"
  options:
    awslogs-group: digitaltwin
    awslogs-stream: backend
```

---

## Log Rotation in Docker

Docker già gestisce log rotation automaticamente:
```yaml
# docker-compose.yml (aggiungere se serve personalizzazione)
logging:
  driver: "json-file"
  options:
    max-size: "50m"
    max-file: "5"
```

Questo limita a 5 file da 50MB ciascuno.

---

## Quick Debug Checklist

Quando qualcosa non funziona:

1. **Check container status**
   ```bash
   docker ps -a | grep backend
   ```

2. **See startup logs**
   ```bash
   docker logs digitaltwin-backend | head -50
   ```

3. **Check LOG_LEVEL**
   ```bash
   docker exec digitaltwin-backend printenv LOG_LEVEL
   ```

4. **Test a request and watch logs**
   ```bash
   # Terminal 1
   docker logs -f digitaltwin-backend

   # Terminal 2
   curl http://localhost:3001/api/health
   ```

5. **Check for errors**
   ```bash
   docker logs digitaltwin-backend | grep -i error
   ```

---

## Changelog

### 2025-12-01
- Added LOG_LEVEL environment variable to docker-compose
- Improved console log formatting for Docker
- System prompt truncated to first 500 chars for readability
- Better handling of large JSON objects

---

## Files Modified

- `docker-compose.yml` - Added LOG_LEVEL env var
- `src/config/logger.js` - Docker-friendly formatting
- `DOCKER_LOGS_GUIDE.md` - This guide

---

Per domande o suggerimenti, aprire una issue nel repository.
