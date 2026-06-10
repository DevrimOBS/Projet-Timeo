import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "../../../common/enums/role.enum";

export class UpdateUserDto {
	@IsOptional()
	@IsString()
	username?: string;

	@IsOptional()
	@IsString()
	@MinLength(8)
	password?: string;

	@IsOptional()
	@IsEnum(Role)
	role?: Role;

	@IsOptional()
	@IsBoolean()
	is_active?: boolean;
}