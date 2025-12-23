import config from '../config/appConfig';
import logger from '../config/logger';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import type { Canvas, SKRSContext2D } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.js';
const { GlobalWorkerOptions, getDocument } = pdfjsLib as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: typeof import('pdfjs-dist/types/src/display/api').getDocument;
};
GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type CanvasModule = typeof import('@napi-rs/canvas');

let canvasModule: CanvasModule | null = null;
let canvasModuleErrorLogged = false;

function getCanvasModule(): CanvasModule | null {
    if (canvasModule) {
        return canvasModule;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        canvasModule = require('@napi-rs/canvas') as CanvasModule;
        const globalWithDOMMatrix = globalThis as typeof globalThis & { DOMMatrix?: typeof canvasModule.DOMMatrix };
        if (!globalWithDOMMatrix.DOMMatrix) {
            globalWithDOMMatrix.DOMMatrix = canvasModule.DOMMatrix;
        }
        return canvasModule;
    } catch (error) {
        if (!canvasModuleErrorLogged) {
            canvasModuleErrorLogged = true;
            logger.warn('Canvas module unavailable; PDF image extraction disabled', { error });
        }
        return null;
    }
}

export interface ExtractedPdfImage {
    buffer: Buffer;
    pageNumber: number;
    mimeType: string;
}

interface PdfExtractionOptions {
    maxImages?: number;
    maxPages?: number;
    pageScale?: number;
}

interface CanvasAndContext {
    canvas: Canvas;
    context: SKRSContext2D;
}

class NodeCanvasFactory {
    create(width: number, height: number): CanvasAndContext {
        if (width <= 0 || height <= 0) {
            throw new Error('Invalid canvas size');
        }
        const module = getCanvasModule();
        if (!module) {
            throw new Error('Canvas module unavailable');
        }
        const canvas = module.createCanvas(Math.ceil(width), Math.ceil(height));
        const context = canvas.getContext('2d');
        return { canvas, context };
    }

    reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
        if (!canvasAndContext.canvas) {
            return;
        }
        canvasAndContext.canvas.width = Math.ceil(width);
        canvasAndContext.canvas.height = Math.ceil(height);
    }

    destroy(canvasAndContext: CanvasAndContext): void {
        if (!canvasAndContext.canvas) {
            return;
        }
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
    }
}

class PdfImageExtractionService {
    async extractImagesFromPdf(buffer: Buffer, options: PdfExtractionOptions = {}): Promise<ExtractedPdfImage[]> {
        if (!buffer || buffer.length === 0) {
            return [];
        }
        if (!getCanvasModule()) {
            return [];
        }

        const {
            maxImages = config.visualExtraction.maxImagesPerDocument,
            maxPages = config.visualExtraction.maxPdfPages,
            pageScale = config.visualExtraction.pdfPageScale,
        } = options;

        const loadingTask = getDocument({ data: buffer, useSystemFonts: true });
        try {
            const document: PDFDocumentProxy = await loadingTask.promise;
            const pageLimit = Math.min(document.numPages, maxPages);
            const images: ExtractedPdfImage[] = [];

            for (let pageIndex = 1; pageIndex <= pageLimit; pageIndex++) {
                if (images.length >= maxImages) {
                    break;
                }

                const page = await document.getPage(pageIndex);
                const renderedBuffer = await this.renderPage(page, pageScale);
                images.push({
                    buffer: renderedBuffer,
                    pageNumber: pageIndex,
                    mimeType: 'image/png',
                });
            }

            await document.cleanup();
            await loadingTask.destroy();
            return images;
        } catch (error) {
            logger.warn('Failed to extract PDF images', { error });
            await loadingTask.destroy().catch(() => undefined);
            return [];
        }
    }

    private async renderPage(page: PDFPageProxy, scale: number): Promise<Buffer> {
        const viewport = page.getViewport({ scale });
        const canvasFactory = new NodeCanvasFactory();
        const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
        const renderContext = {
            canvasContext: canvasAndContext.context,
            viewport,
            canvas: canvasAndContext.canvas,
            canvasFactory,
        };

        await page.render(renderContext).promise;

        const imageBuffer = canvasAndContext.canvas.toBuffer('image/png');
        canvasFactory.destroy(canvasAndContext);
        return imageBuffer;
    }
}

export default new PdfImageExtractionService();
