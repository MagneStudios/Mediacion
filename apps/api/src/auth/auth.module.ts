import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthGuard } from "./auth.guard";
import { Hs256TokenVerifier } from "./hs256-token-verifier";
import { RolesGuard } from "./roles.guard";
import { TOKEN_VERIFIER } from "./token-verifier";
import { UsersRepository } from "./users.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: TOKEN_VERIFIER, useClass: Hs256TokenVerifier },
    UsersRepository,
    AuthGuard,
    RolesGuard,
  ],
  exports: [AuthGuard, RolesGuard, UsersRepository, TOKEN_VERIFIER],
})
export class AuthModule {}
