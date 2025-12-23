import type { Express } from 'express';
import config from '../config/appConfig';
import logger from '../config/logger';
import LLMService from './llmService';
import { StructuredTable } from './structuredTableExtractionService';

const DEFAULT_VISUAL_PROMPT = `
You are a document analyst converting page screenshots into structured markdown tables and summaries.
Return ONLY valid JSON with the following schema:
{
  "textSummary": "Concise description of the page in markdown",
  "tables": [
    {
      "title": "Table name",
      "rows": [
        ["Header 1", "Header 2"],
        ["Row 1 Col 1", "Row 1 Col 2"]
      ]
    }
  ],
  "figures": [
    {
      "title": "Figure name",
      "description": "Short caption"
    }
  ]
}
`.trim();

interface VisualExtractionResult {
    textSummary?: string;
    tables?: StructuredTable[];
    figures?: Array<{ title: string; description: string }>;
}

export interface VisualInsightSection {
    contextText: string;
    embeddingDescription: string;
    metadata: {
        fileName: string;
        pageNumber?: number;
        type: 'summary' | 'figure';
        figureTitle?: string;
    };
    enrichment?: {
        title?: string;
        highlights?: string[];
        question?: string;
    };
}

export interface VisualExtractionPayload {
    sections: VisualInsightSection[];
    tables: StructuredTable[];
}

class VisualExtractionService {
    isEnabled(): boolean {
        return Boolean(config.visualExtraction?.enabled);
    }

    isImageMimeType(mimeType: string): boolean {
        return config.visualExtraction?.imageMimeTypes.includes(mimeType) ?? false;
    }

    /**
     * Extract textual insights from image-based documents using a vision-capable LLM.
     * Returns formatted markdown section or null if not applicable.
     */
    async extractVisualInsights(file: Express.Multer.File): Promise<VisualExtractionPayload | null> {
        if (!this.isEnabled() || !file) {
            return null;
        }

        if (this.isImageMimeType(file.mimetype)) {
            return this.describeImageWithStructure(file);
        }

        if (file.mimetype === 'application/pdf') {
            return this.describePdfPages(file);
        }

        return null;
    }

    private async describeImageWithStructure(file: Express.Multer.File): Promise<VisualExtractionPayload | null> {
        try {
            const result = await this.describeBufferStructured(file.buffer, file.mimetype, undefined, file.originalname);
            if (!result) {
                return null;
            }

            const sections: VisualInsightSection[] = [];
            if (result.textSummary) {
                sections.push({
                    contextText: `${config.visualExtraction.sectionHeading} - ${file.originalname}\n\n${result.textSummary}`,
                    embeddingDescription: result.textSummary,
                    metadata: {
                        fileName: file.originalname,
                        type: 'summary',
                    },
                });
            }

            if (result.figures?.length) {
                for (const figure of result.figures) {
                    if (!figure.description) continue;
                    sections.push({
                        contextText: `### Figure: ${figure.title || 'Visual Element'}\n\n${figure.description}`,
                        embeddingDescription: `${figure.title || 'Visual element'}: ${figure.description}`,
                        metadata: {
                            fileName: file.originalname,
                            type: 'figure',
                            figureTitle: figure.title,
                        },
                    });
                }
            }

            if (!sections.length && !(result.tables?.length)) {
                return null;
            }

            const enrichedSections = await this.enrichVisualSections(sections);

            return {
                sections: enrichedSections,
                tables: result.tables || [],
            };
        } catch (error) {
            logger.warn('Structured image description failed', {
                fileName: file.originalname,
                error,
            });
            return null;
        }
    }

    private async describePdfPages(file: Express.Multer.File): Promise<VisualExtractionPayload | null> {
        try {
            const { default: PdfImageExtractionService } = await import('./pdfImageExtractionService');
            const pageImages = await PdfImageExtractionService.extractImagesFromPdf(file.buffer, {
                maxImages: config.visualExtraction.maxImagesPerDocument,
                maxPages: config.visualExtraction.maxPdfPages,
                pageScale: config.visualExtraction.pdfPageScale,
            });

            if (!pageImages.length) {
                return null;
            }

            const sections: VisualInsightSection[] = [];
            const tables: StructuredTable[] = [];

            for (const pageImage of pageImages) {
                const result = await this.describeBufferStructured(
                    pageImage.buffer,
                    pageImage.mimeType,
                    pageImage.pageNumber,
                    file.originalname
                );

                if (!result) {
                    continue;
                }

                if (result.textSummary) {
                    sections.push({
                        contextText: `${config.visualExtraction.sectionHeading} - ${file.originalname} (Page ${pageImage.pageNumber})\n\n${result.textSummary}`,
                        embeddingDescription: result.textSummary,
                        metadata: {
                            fileName: file.originalname,
                            pageNumber: pageImage.pageNumber,
                            type: 'summary',
                        },
                    });
                }

                if (result.figures?.length) {
                    for (const figure of result.figures) {
                        if (!figure.description) continue;
                        sections.push({
                            contextText: `### Figure: ${figure.title || 'Visual Element'} (Page ${pageImage.pageNumber})\n\n${figure.description}`,
                            embeddingDescription: `${figure.title || 'Visual element'} page ${pageImage.pageNumber}: ${figure.description}`,
                            metadata: {
                                fileName: file.originalname,
                                pageNumber: pageImage.pageNumber,
                                type: 'figure',
                                figureTitle: figure.title,
                            },
                        });
                    }
                }

                if (result.tables?.length) {
                    for (const table of result.tables) {
                        tables.push({
                            ...table,
                            pageNumber: pageImage.pageNumber,
                            fileName: file.originalname,
                        });
                    }
                }
            }

            if (!sections.length && !tables.length) {
                return null;
            }

            const enrichedSections = await this.enrichVisualSections(sections);

            return {
                sections: enrichedSections,
                tables,
            };
        } catch (error) {
            logger.warn('PDF visual extraction failed', {
                fileName: file.originalname,
                error,
            });
            return null;
        }
    }

    private async describeBuffer(buffer: Buffer, mimeType: string): Promise<string | null> {
        const caption = await LLMService.describeImageFromBuffer({
            buffer,
            mimeType,
            prompt: config.visualExtraction.captionPrompt,
            provider: config.visualExtraction.visionProvider,
            model: config.visualExtraction.visionModel,
        });

        if (!caption || caption.trim().length === 0) {
            return null;
        }

        return caption.trim();
    }

    private async describeBufferStructured(
        buffer: Buffer,
        mimeType: string,
        pageNumber?: number,
        fileName = 'Visual Asset'
    ): Promise<VisualExtractionResult | null> {
        try {
            const prompt = config.visualExtraction.captionPrompt || DEFAULT_VISUAL_PROMPT;
            const response = await LLMService.describeImageFromBuffer({
                buffer,
                mimeType,
                prompt,
                provider: config.visualExtraction.visionProvider,
                model: config.visualExtraction.visionModel,
                maxTokens: 800,
            });

            if (!response || response.trim().length === 0) {
                return null;
            }

            const parsed = this.safeJsonParse(response);
            if (!parsed) {
                logger.warn('Structured vision response could not be parsed as JSON', { preview: response.slice(0, 200) });
                return {
                    textSummary: response,
                };
            }

            const tables = Array.isArray(parsed.tables)
                ? parsed.tables
                    .map((table): StructuredTable | null => {
                        if (!Array.isArray(table?.rows) || !table.rows.length) {
                            return null;
                        }
                        return {
                            id: table.id || `vision-${pageNumber || 0}-${Math.random().toString(36).slice(2)}`,
                            title: table.title || `Visual Table ${pageNumber ? `Page ${pageNumber}` : ''}`.trim(),
                            rows: table.rows,
                            source: 'vision',
                            fileName,
                            pageNumber,
                            summary: typeof table.summary === 'string' ? table.summary : undefined,
                        };
                    })
                    .filter(Boolean) as StructuredTable[]
                : [];

            return {
                textSummary: typeof parsed.textSummary === 'string' ? parsed.textSummary : undefined,
                tables,
                figures: Array.isArray(parsed.figures) ? parsed.figures : undefined,
            };
        } catch (error) {
            logger.warn('Structured visual extraction failed', {
                error,
            });
            return null;
        }
    }

    private async enrichVisualSections(sections: VisualInsightSection[]): Promise<VisualInsightSection[]> {
        if (!sections.length || !config.ragOptimization.assetEnrichment.visuals.enabled) {
            return sections;
        }

        const promptTemplate = config.ragOptimization.assetEnrichment.visuals.promptTemplate;
        const maxTokens = config.ragOptimization.assetEnrichment.visuals.maxTokens;

        return Promise.all(
            sections.map(async section => {
                try {
                    const prompt = promptTemplate.replace(
                        '{{DESCRIPTION}}',
                        section.embeddingDescription || section.contextText || ''
                    );

                    const response = await LLMService.generateResponse(
                        'openai',
                        'gpt-4o-mini',
                        [
                            {
                                role: 'user',
                                content: prompt,
                            },
                        ],
                        'Return only JSON.',
                        0.2,
                        maxTokens
                    );

                    const parsed = this.safeJsonParse(response.content);
                    if (parsed) {
                        section.enrichment = {
                            title: typeof parsed.title === 'string' ? parsed.title : undefined,
                            highlights: Array.isArray(parsed.highlights)
                                ? parsed.highlights.filter((item: unknown): item is string => typeof item === 'string')
                                : undefined,
                            question: typeof parsed.question === 'string' ? parsed.question : undefined,
                        };

                        if (section.enrichment.title) {
                            section.embeddingDescription = `${section.enrichment.title}: ${section.embeddingDescription}`;
                        }
                    }
                } catch (error) {
                    logger.warn('Visual enrichment failed', {
                        fileName: section.metadata.fileName,
                        pageNumber: section.metadata.pageNumber,
                        error,
                    });
                }
                return section;
            })
        );
    }

    private safeJsonParse(text: string): Record<string, unknown> | null {
        try {
            return JSON.parse(text);
        } catch {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                try {
                    return JSON.parse(text.slice(start, end + 1));
                } catch {
                    return null;
                }
            }
            return null;
        }
    }
}

export default new VisualExtractionService();
