import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthGuard } from "./auth.guard";
import { Hs256TokenVerifier } from "./hs256-token-verifier";
import { TOKEN_VERIFIER } from "./token-verifier";
import { UsersRepository } from "./users.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: TOKEN_VERIFIER, useClass: Hs256TokenVerifier },
    UsersRepository,
    AuthGuard,
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
