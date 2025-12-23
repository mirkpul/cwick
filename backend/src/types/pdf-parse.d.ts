declare module 'pdf-parse' {
  interface PDFMetadata {
    Author?: string;
    Title?: string;
    [key: string]: unknown;
  }

  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: PDFMetadata | null;
    version: string;
    text: string;
  }

  interface PDFParseOptions {
    pagerender?: (pageData: unknown) => string | Promise<string>;
    max?: number;
    version?: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;

  export default pdfParse;
}
