import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");

@Global()
@Module({
  providers: [
    ConfigService,
    {
      provide: DATABASE_CONNECTION,
      useFactory: async (configService: ConfigService) => {
        const connectionString =
          configService.getOrThrow<string>(`DATABASE_URL`);
        const queryClient = postgres(connectionString);
        return drizzle(queryClient);
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
