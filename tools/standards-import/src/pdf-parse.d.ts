/** pdf-parse index.js는 직접 import 시 데모 코드가 실행되어 lib 경로를 쓴다. */
declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdfParse(buffer: Buffer): Promise<{ text: string; numpages: number }>;
  export default pdfParse;
}
