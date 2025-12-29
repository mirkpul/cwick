# Knowledge Base File Upload API

## Overview
Allows uploading, parsing, chunking, and embedding of documents (PDF, TXT, MD, CSV, DOCX, PPTX) into the knowledge base.

## API Endpoints

### 1. Upload File
**POST** `/api/knowledge-bases/:kbId/knowledge/upload`

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
**GET** `/api/knowledge-bases/:kbId/knowledge/search?q=query&limit=5`

**Response**:
```json
{
  "results": [
    {
      "id": "uuid",
      "content": "...",
      "similarity": 0.94,
      "file_name": "docs.pdf",
      "source": "knowledge_base"
    }
  ]
}
```

### 3. List Files
**GET** `/api/knowledge-bases/:kbId/knowledge/files`

### 4. Delete File
**DELETE** `/api/knowledge-bases/:kbId/knowledge/file/:entryId`

## Implementation Details
- **Chunking**: Hybrid strategy (Paragraph -> Sentence) with overlap.
- **Vectors**: Uses specialized embedding models (OpenAI/Anthropic).
- **Storage**: PostgreSQL `pgvector`.
