import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Role } from "../../../common/enums/role.enum";

export class CreateUserDto {
	@IsString()
	username!: string;

	@IsString()
	@MinLength(8)
	password!: string;

	@IsEnum(Role)
	role!: Role;

	@IsOptional()
	@IsBoolean()
	is_active?: boolean;
}