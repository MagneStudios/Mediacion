import { Module } from "@nestjs/common";
import { KYSELY } from "./database.tokens";
import { kyselyProvider } from "./kysely.provider";

@Module({
  providers: [kyselyProvider],
  exports: [KYSELY],
})
export class DatabaseModule {}
