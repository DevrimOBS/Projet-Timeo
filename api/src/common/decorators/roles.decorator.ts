import { Role } from "../enums/role.enum";

const SetMetadata = <K = string, V = unknown>(metadataKey: K, metadataValue: V) => {
	return (
		target: object,
		propertyKey?: string | symbol,
		descriptor?: PropertyDescriptor,
	) => {
		const metadataTarget = descriptor?.value ?? target;
		(Reflect as any).defineMetadata(metadataKey, metadataValue, metadataTarget);
	};
};

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
