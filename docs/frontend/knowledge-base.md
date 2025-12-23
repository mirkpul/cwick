# Knowledge Base Upload (Frontend)

## Overview
The Professional Dashboard supports drag-and-drop file uploads for the knowledge base.

## Features
- **Semantic Search**: Text box to test KB retrieval (Results show similarity scores).
- **Document Upload**: Supports PDF, TXT, MD, CSV (Max 10MB).
- **Management**: List view of files with delete capability.

## Components
- `FileUploadDropZone.jsx`: Handles D&D and validation.
- `KnowledgeBaseFileList.jsx`: Displays uploaded file metadata.
- `SemanticSearch.jsx`: Interface for testing retrieval.

## API Integration
Uses `digitalTwinAPI` service methods:
- `uploadKnowledgeFile`
- `listKnowledgeFiles`
- `deleteKnowledgeFile`
- `searchKnowledge`

## UX Flow
1. User drags file -> Upload & Process (Chunking/Embedding) -> Success Toast.
2. User types query -> Click Search -> View ranked chunks with preview.
