export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(options: {
    message: string;
    statusCode: number;
    code: string;
    details?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}
