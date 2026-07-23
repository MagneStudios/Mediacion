import { HttpException, HttpStatus } from "@nestjs/common";

export class ConflictError extends HttpException {
  constructor(detail: string) {
    super({ code: "conflict", message: "Conflict" }, HttpStatus.CONFLICT, {
      cause: new Error(detail),
    });
  }
}
