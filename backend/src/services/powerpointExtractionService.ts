import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import logger from '../config/logger';

const execFileAsync = promisify(execFile);

export interface PowerPointSlide {
    index: number;
    title?: string;
    text: string;
}

class PowerPointExtractionService {
    private static readonly pptMimeTypes = new Set([
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]);

    isPowerPointFile(file: Express.Multer.File): boolean {
        if (!file) {
            return false;
        }
        const ext = (file.originalname || '').toLowerCase();
        return (
            PowerPointExtractionService.pptMimeTypes.has(file.mimetype) ||
            ext.endsWith('.ppt') ||
            ext.endsWith('.pptx')
        );
    }

    async extractSlides(file: Express.Multer.File): Promise<PowerPointSlide[]> {
        if (!this.isPowerPointFile(file)) {
            return [];
        }

        const extension = (file.originalname || '').toLowerCase();
        if (extension.endsWith('.ppt')) {
            logger.warn('Legacy PPT binary files are not supported for text extraction yet', {
                fileName: file.originalname,
            });
            return [];
        }

        try {
            return await this.extractSlidesFromPptx(file.buffer, file.originalname);
        } catch (error) {
            logger.warn('PowerPoint slide extraction failed', {
                fileName: file.originalname,
                error,
            });
            return [];
        }
    }

    private async extractSlidesFromPptx(buffer: Buffer, fileName: string): Promise<PowerPointSlide[]> {
        const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-'));
        const archivePath = path.join(workDir, 'presentation.pptx');
        const extractDir = path.join(workDir, 'extract');

        try {
            await fs.writeFile(archivePath, buffer);
            await fs.mkdir(extractDir);
            await execFileAsync('unzip', ['-qq', '-o', archivePath, '-d', extractDir]);

            const slideDir = path.join(extractDir, 'ppt', 'slides');
            let slideFiles: string[] = [];
            try {
                slideFiles = (await fs.readdir(slideDir)).filter(name => /^slide\d+\.xml$/i.test(name));
            } catch {
                logger.warn('No slide directory found inside PowerPoint archive', { fileName });
                return [];
            }

            slideFiles.sort((a, b) => this.extractSlideNumber(a) - this.extractSlideNumber(b));

            const slides: PowerPointSlide[] = [];
            for (const slideFile of slideFiles) {
                const slideNumber = this.extractSlideNumber(slideFile);
                const xmlPath = path.join(slideDir, slideFile);
                const xmlContent = await fs.readFile(xmlPath, 'utf-8');
                const text = this.extractTextFromSlideXml(xmlContent);
                if (!text.trim()) {
                    continue;
                }
                const title = this.extractTitleFromSlide(xmlContent);
                slides.push({
                    index: slideNumber - 1,
                    title,
                    text,
                });
            }

            return slides;
        } finally {
            await fs.rm(workDir, { recursive: true, force: true });
        }
    }

    private extractSlideNumber(fileName: string): number {
        const match = fileName.match(/slide(\d+)\.xml/i);
        if (!match) {
            return 0;
        }
        return parseInt(match[1], 10);
    }

    private extractTextFromSlideXml(xml: string): string {
        const matches = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g));
        const texts = matches
            .map(match => this.decodeEntities(match[1]))
            .map(text => text.trim())
            .filter(Boolean);
        return texts.join('\n');
    }

    private extractTitleFromSlide(xml: string): string | undefined {
        const match = xml.match(/<p:title>[\s\S]*?<a:t[^>]*>([\s\S]*?)<\/a:t>[\s\S]*?<\/p:title>/i);
        if (match) {
            return this.decodeEntities(match[1]).trim() || undefined;
        }
        const fallback = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/);
        return fallback ? this.decodeEntities(fallback[1]).trim() || undefined : undefined;
    }

    private decodeEntities(text: string): string {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    }
}

export default new PowerPointExtractionService();
