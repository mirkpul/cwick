import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import config from '../config/appConfig';

// Configure multer for file uploads
// Store files in memory as buffers for processing
const storage = multer.memoryStorage();

// File filter to validate file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (config.fileUpload.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.fileUpload.maxSizeBytes,
  },
});

export default upload;
