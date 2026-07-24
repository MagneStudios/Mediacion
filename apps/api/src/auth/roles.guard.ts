import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest, RolUsuario } from "./authenticated-user";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      RolUsuario[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const callerRole = request.user?.rol;
    if (callerRole && requiredRoles.includes(callerRole)) {
      return true;
    }

    throw new HttpException(
      {
        code: "forbidden_role",
        message: "Caller role is not permitted for this route",
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
