import type { CanActivate, ExecutionContext } from "@nestjs/common";
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "./authenticated-user";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { TokenVerifier } from "./token-verifier";
import { TOKEN_VERIFIER } from "./token-verifier";
import { UsersRepository } from "./users.repository";

function extractBearerToken(
  authorization: string | undefined,
): string | undefined {
  const [scheme, token] = authorization?.split(" ") ?? [];
  return scheme === "Bearer" ? token : undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const claims = await this.tokenVerifier.verify(token).catch(() => {
      throw new UnauthorizedException("Invalid or expired token");
    });

    const user = await this.usersRepository
      .findAuthById(claims.sub)
      .catch((error: unknown) => {
        const repositoryError =
          error instanceof Error ? error : new Error(String(error));
        this.logger.error(repositoryError.message);
        throw new HttpException(
          { code: "internal_error", message: "Internal server error" },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    if (!user) {
      throw new HttpException(
        { code: "user_not_provisioned", message: "User is not provisioned" },
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.user = user;
    return true;
  }
}
