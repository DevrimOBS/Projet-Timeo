import { Request } from "express";
import { Role } from "../enums/role.enum";

export interface RequestWithUser extends Request {
  user?: {
    role: Role;
    subject: string;
  };
}