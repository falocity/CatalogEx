import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  public constructor(field: string, message: string) {
    super('VALIDATION_ERROR', message, StatusCodes.BAD_REQUEST, field);

    this.name = 'ValidationError';
  }
}
