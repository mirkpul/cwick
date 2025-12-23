export interface User {
    id: string;
    email: string;
    full_name: string;
    role: 'professional' | 'super_admin' | 'end_user';
    created_at?: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

// Knowledge Base File Upload Types
export interface UploadedFile {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    total_chunks: number;
    created_at: string;
}

export interface FileUploadResponse {
    success: boolean;
    entriesCreated: number;
    fileName: string;
    fileSize: number;
    chunks: number;
}

export interface KnowledgeSearchResult {
    id: string;
    title: string;
    content: string;
    content_type: string;
    file_name?: string;
    chunk_index?: number;
    total_chunks?: number;
    similarity: number;
    created_at: string;
}

export interface SearchResponse {
    results: KnowledgeSearchResult[];
}
