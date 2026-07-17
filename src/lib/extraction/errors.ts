export type ProcessingErrorCode =
  | "invalid_file_type"
  | "file_too_large"
  | "invalid_encoding"
  | "binary_text"
  | "invalid_pdf"
  | "encrypted_pdf"
  | "too_many_pages"
  | "empty_source"
  | "text_limit_exceeded"
  | "chunk_limit_exceeded";

export class SourceProcessingError extends Error {
  readonly code: ProcessingErrorCode;
  readonly sourceType: "slides" | "transcript" | "notes";

  constructor(
    code: ProcessingErrorCode,
    sourceType: "slides" | "transcript" | "notes",
    message: string,
  ) {
    super(message);
    this.name = "SourceProcessingError";
    this.code = code;
    this.sourceType = sourceType;
  }
}
