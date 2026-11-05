import { StatusCodes } from "http-status-codes";

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly field?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super("VALIDATION_ERROR", message, StatusCodes.BAD_REQUEST, field);

    this.name = "ValidationError";
  }
}
