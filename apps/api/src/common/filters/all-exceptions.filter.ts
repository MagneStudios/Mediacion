import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";

const statusCodes: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "bad_request",
  [HttpStatus.UNAUTHORIZED]: "unauthorized",
  [HttpStatus.FORBIDDEN]: "forbidden",
  [HttpStatus.NOT_FOUND]: "not_found",
};

function codeForStatus(status: number): string {
  return statusCodes[status] ?? "error";
}

function codeFromException(exception: HttpException): string {
  const response = exception.getResponse();
  if (
    typeof response === "object" &&
    response !== null &&
    "code" in response &&
    typeof response.code === "string"
  ) {
    return response.code;
  }
  return codeForStatus(exception.getStatus());
}

function messageFromException(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === "string") {
    return response;
  }
  if (
    typeof response === "object" &&
    response !== null &&
    "message" in response &&
    typeof response.message === "string"
  ) {
    return response.message;
  }
  return exception.message;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        error: {
          code: codeFromException(exception),
          message: messageFromException(exception),
        },
      });
      return;
    }

    const unknownError =
      exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(unknownError.message, unknownError.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "internal_error",
        message: "Internal server error",
      },
    });
  }
}
