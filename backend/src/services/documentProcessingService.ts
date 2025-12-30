import axios from 'axios';
import FormData from 'form-data';

const baseURL = process.env.DOC_PROCESSING_URL || 'http://localhost:3015';

class DocumentProcessingService {
  isEnabled(): boolean {
    return !!process.env.DOC_PROCESSING_URL;
  }

  async ingest(kbId: string, file: Express.Multer.File): Promise<{ entriesCreated?: number; chunks?: number; fileName?: string; jobId?: string }> {
    const form = new FormData();
    form.append('kbId', kbId);
    form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

    const response = await axios.post(`${baseURL}/ingest`, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
    });

    return response.data.data;
  }
}

export default new DocumentProcessingService();
