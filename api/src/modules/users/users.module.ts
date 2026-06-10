import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DatabaseModule } from "../../database/database.module";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
	imports: [DatabaseModule],
	controllers: [UsersController],
	providers: [UsersService, Reflector, BasicAuthGuard, RolesGuard],
	exports: [UsersService]
})
export class UsersModule {}