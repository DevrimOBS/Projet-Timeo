import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { BasicAuthGuard } from "../../common/guards/basic-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { RequestWithUser } from "../../common/types/request-with-user";
import { CreateUserDto } from "./dto/create-user.dto";
import { DisableMfaDto } from "./dto/disable-mfa.dto";
import { EnableMfaDto } from "./dto/enable-mfa.dto";
import { RotateRecoveryCodesDto } from "./dto/rotate-recovery-codes.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@Controller("api/users")
@UseGuards(BasicAuthGuard, RolesGuard)
export class UsersController {
	constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

	@Get()
	@Roles(Role.ADMIN)
	listUsers() {
		return this.usersService.listUsers();
	}

	@Get("me")
	@Roles(Role.ADMIN, Role.VIEWER, Role.AGENT)
	getCurrentUser(@Req() request: RequestWithUser) {
		return this.usersService.getCurrentUser(request.user?.subject ?? "");
	}

	@Post()
	@Roles(Role.ADMIN)
	createUser(@Body() payload: CreateUserDto) {
		return this.usersService.createUser(payload);
	}

	@Patch(":userId")
	@Roles(Role.ADMIN)
	updateUser(@Param("userId") userId: string, @Body() payload: UpdateUserDto) {
		return this.usersService.updateUser(userId, payload);
	}

	@Post("me/mfa/setup")
	@Roles(Role.ADMIN, Role.VIEWER, Role.AGENT)
	setupOwnMfa(@Req() request: RequestWithUser) {
		return this.usersService.beginMfaSetup(request.user?.subject ?? "");
	}

	@Post("me/mfa/enable")
	@Roles(Role.ADMIN, Role.VIEWER, Role.AGENT)
	enableOwnMfa(@Req() request: RequestWithUser, @Body() payload: EnableMfaDto) {
		return this.usersService.enableMfa(request.user?.subject ?? "", payload.otp);
	}

	@Post("me/mfa/disable")
	@Roles(Role.ADMIN, Role.VIEWER, Role.AGENT)
	disableOwnMfa(@Req() request: RequestWithUser, @Body() payload: DisableMfaDto) {
		return this.usersService.disableOwnMfa(request.user?.subject ?? "", payload.otp, payload.recoveryCode);
	}

	@Post("me/mfa/recovery-codes")
	@Roles(Role.ADMIN, Role.VIEWER, Role.AGENT)
	rotateOwnRecoveryCodes(@Req() request: RequestWithUser, @Body() payload: RotateRecoveryCodesDto) {
		return this.usersService.rotateRecoveryCodes(request.user?.subject ?? "", payload.otp);
	}

	@Post(":userId/mfa/disable")
	@Roles(Role.ADMIN)
	disableUserMfa(@Param("userId") userId: string) {
		return this.usersService.disableMfa(userId);
	}
}