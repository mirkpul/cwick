import { randomUUID } from 'crypto';
import logger from '../config/logger';

export interface StructuredTable {
    id: string;
    title: string;
    rows: string[][];
    source: 'text' | 'csv' | 'vision';
    fileName: string;
    pageNumber?: number;
    summary?: string;
    validation?: {
        status: 'passed' | 'failed' | 'skipped';
        confidence?: number;
        message?: string;
    };
    enrichment?: {
        summary?: string;
        highlights?: string[];
        question?: string;
    };
}

interface ExtractTablesParams {
    mimeType: string;
    buffer: Buffer;
    rawText?: string;
    fileName: string;
}

const MIN_COLUMNS = 2;
const MIN_ROWS = 2;

class StructuredTableExtractionService {
    async extractStructuredTables(params: ExtractTablesParams): Promise<StructuredTable[]> {
        const { mimeType, buffer, rawText, fileName } = params;

        if (mimeType === 'text/csv') {
            return this.extractFromCsv(buffer.toString('utf-8'), fileName);
        }

        if (!rawText || rawText.trim().length === 0) {
            return [];
        }

        if (mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType === 'text/markdown') {
            return this.extractFromText(rawText, fileName);
        }

        return [];
    }

    renderMarkdown(table: StructuredTable): string {
        if (!table.rows.length) {
            return '';
        }

        const [header, ...body] = table.rows;
        const headerLine = `| ${header.join(' | ')} |`;
        const dividerLine = `| ${header.map(() => '---').join(' | ')} |`;
        const bodyLines = body.map(row => `| ${row.join(' | ')} |`);

        const heading = table.title || 'Table';
        const summary = table.summary ? `${table.summary}\n\n` : '';
        const pageInfo = typeof table.pageNumber === 'number' ? ` (Page ${table.pageNumber})` : '';

        return `### ${heading}${pageInfo}\n\n${summary}${[headerLine, dividerLine, ...bodyLines].join('\n')}`;
    }

    private extractFromText(text: string, fileName: string): StructuredTable[] {
        const lines = text
            .split(/\r?\n/)
            .map(line => line.replace(/\u00a0/g, ' ').trimEnd());

        const tables: StructuredTable[] = [];
        let currentBlock: string[][] = [];
        let currentStartLine = 0;

        const flushBlock = (): void => {
            if (currentBlock.length >= MIN_ROWS) {
                const table: StructuredTable = {
                    id: randomUUID(),
                    title: this.inferTableTitle(lines, currentStartLine),
                    rows: this.normalizeRows(currentBlock),
                    source: 'text',
                    fileName,
                };
                if (table.rows.length >= MIN_ROWS && table.rows[0].length >= MIN_COLUMNS) {
                    table.summary = this.buildTableSummary(table);
                    tables.push(table);
                }
            }
            currentBlock = [];
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parsedRow = this.parseTableRow(line);

            if (parsedRow) {
                if (currentBlock.length === 0) {
                    currentStartLine = i;
                }
                currentBlock.push(parsedRow);
            } else if (currentBlock.length > 0) {
                flushBlock();
            }
        }

        if (currentBlock.length > 0) {
            flushBlock();
        }

        if (tables.length) {
            logger.debug(`Structured table extraction detected ${tables.length} tables from ${fileName}`);
        }

        return tables;
    }

    private extractFromCsv(csv: string, fileName: string): StructuredTable[] {
        const rows = this.parseCsv(csv);
        if (rows.length === 0 || rows[0].length < MIN_COLUMNS) {
            return [];
        }

        const table: StructuredTable = {
            id: randomUUID(),
            title: `${fileName} (CSV)`,
            rows,
            source: 'csv',
            fileName,
        };
        table.summary = this.buildTableSummary(table);
        return [table];
    }

    private parseTableRow(line: string): string[] | null {
        const trimmed = line.trim();

        if (!trimmed || /^[-\u2013\u2014\s]+$/.test(trimmed)) {
            return null;
        }

        const cells = trimmed
            .split(/\s{2,}|\t+/)
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);

        if (cells.length < MIN_COLUMNS) {
            return null;
        }

        const averageLength = cells.reduce((sum, cell) => sum + cell.length, 0) / cells.length;
        if (averageLength < 2) {
            return null;
        }

        return cells;
    }

    private normalizeRows(rows: string[][]): string[][] {
        const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
        return rows
            .map(row => {
                if (row.length === maxColumns) {
                    return row;
                }
                const padded = [...row];
                while (padded.length < maxColumns) {
                    padded.push('');
                }
                return padded;
            })
            .slice(0, 50); // prevent extremely large tables
    }

    private inferTableTitle(lines: string[], startLine: number): string {
        for (let i = startLine - 1; i >= Math.max(0, startLine - 3); i--) {
            const candidate = lines[i]?.trim();
            if (candidate && candidate.length <= 120) {
                return candidate.replace(/[:\-–]+$/, '').trim();
            }
        }
        return `Extracted Table ${startLine + 1}`;
    }

    private buildTableSummary(table: StructuredTable): string {
        const headerPreview = table.rows[0]?.slice(0, 5).join(', ') || '';
        const rowCount = table.rows.length - 1;
        const columnCount = table.rows[0]?.length || 0;
        const summaryParts = [
            `${rowCount} rows`,
            `${columnCount} columns`,
            headerPreview ? `headers: ${headerPreview}` : null,
        ].filter(Boolean);
        return `Summary: ${summaryParts.join(' • ')}`;
    }

    private parseCsv(csv: string): string[][] {
        const rows: string[][] = [];
        let currentCell = '';
        let currentRow: string[] = [];
        let inQuotes = false;

        const flushCell = (): void => {
            currentRow.push(currentCell.trim());
            currentCell = '';
        };

        const flushRow = (): void => {
            if (currentRow.length > 0) {
                rows.push(currentRow);
            }
            currentRow = [];
        };

        for (let i = 0; i < csv.length; i++) {
            const char = csv[i];
            const nextChar = csv[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === ',' && !inQuotes) {
                flushCell();
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                flushCell();
                flushRow();
                continue;
            }

            currentCell += char;
        }

        if (currentCell.length > 0 || inQuotes) {
            flushCell();
        }
        if (currentRow.length > 0) {
            flushRow();
        }

        return rows;
    }
}

export default new StructuredTableExtractionService();
