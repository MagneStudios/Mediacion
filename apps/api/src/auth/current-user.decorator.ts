import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";
import type { AuthenticatedRequest } from "./authenticated-user";

export function currentUserFactory(_data: unknown, context: ExecutionContext) {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
}

export const CurrentUser = createParamDecorator(currentUserFactory);
