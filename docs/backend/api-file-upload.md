# Knowledge Base File Upload API

## Overview
Allows uploading parsing, chunking, and embedding of documents (PDF, TXT, MD, CSV) into the knowledge base.

## API Endpoints

### 1. Upload File
**POST** `/api/digital-twins/:twinId/knowledge/upload`

**Headers**: `Authorization: Bearer <TOKEN>`, `Content-Type: multipart/form-data`

**Form Data**:
- `file`: The document
- `chunkSize` (optional): Default 500

**Response**:
```json
{
  "success": true,
  "fileName": "docs.pdf",
  "chunks": 5
}
```

### 2. Search Knowledge
**GET** `/api/digital-twins/:twinId/knowledge/search?q=query&limit=5`

**Response**:
```json
{
  "results": [
    {
      "id": "uuid",
      "content": "...",
      "similarity": 0.94,
      "file_name": "docs.pdf"
    }
  ]
}
```

### 3. List Files
**GET** `/api/digital-twins/:twinId/knowledge/files`

### 4. Delete File
**DELETE** `/api/digital-twins/:twinId/knowledge/file/:entryId`

## Implementation Details
- **Chunking**: Hybrid strategy (Paragraph -> Sentence) with overlap.
- **Vectors**: Uses specialized embedding models (OpenAI/Anthropic).
- **Storage**: PostgreSQL `pgvector`.
