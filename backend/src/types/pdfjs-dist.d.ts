declare module 'pdfjs-dist/legacy/build/pdf.js' {
  const pdfjs: unknown;
  export = pdfjs;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.js' {
  const workerSrc: string;
  export default workerSrc;
}
