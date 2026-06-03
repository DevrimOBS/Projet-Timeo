"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Roles = exports.ROLES_KEY = void 0;
const SetMetadata = (metadataKey, metadataValue) => {
    return (target, propertyKey, descriptor) => {
        const metadataTarget = descriptor?.value ?? target;
        Reflect.defineMetadata(metadataKey, metadataValue, metadataTarget);
    };
};
exports.ROLES_KEY = "roles";
const Roles = (...roles) => SetMetadata(exports.ROLES_KEY, roles);
exports.Roles = Roles;
