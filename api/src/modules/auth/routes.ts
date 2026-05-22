import { NextFunction, Request, Response, Router } from "express";
import { Role } from "../../common/enums/role.enum";

export const authRouter = Router();

interface RequestWithAuth extends Request {
  auth?: {
    role: Role;
    subject: string;
  };
}

function authenticate(req: RequestWithAuth, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    next();
    return;
  }

  const adminToken = process.env.ADMIN_TOKEN ?? "admin-dev-token";
  const viewerToken = process.env.VIEWER_TOKEN ?? "viewer-dev-token";
  const agentToken = process.env.AGENT_TOKEN ?? "agent-dev-token";

  if (token === adminToken) {
    req.auth = { role: Role.ADMIN, subject: "admin" };
  } else if (token === viewerToken) {
    req.auth = { role: Role.VIEWER, subject: "viewer" };
  } else if (token === agentToken) {
    req.auth = { role: Role.AGENT, subject: "agent" };
  }

  next();
}

authRouter.get("/me", authenticate, (req: RequestWithAuth, res: Response) => {
  res.json({
    subject: req.auth?.subject,
    role: req.auth?.role
  });
});
