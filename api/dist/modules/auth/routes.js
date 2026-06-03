"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const role_enum_1 = require("../../common/enums/role.enum");
exports.authRouter = (0, express_1.Router)();
function authenticate(req, _res, next) {
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
        req.auth = { role: role_enum_1.Role.ADMIN, subject: "admin" };
    }
    else if (token === viewerToken) {
        req.auth = { role: role_enum_1.Role.VIEWER, subject: "viewer" };
    }
    else if (token === agentToken) {
        req.auth = { role: role_enum_1.Role.AGENT, subject: "agent" };
    }
    next();
}
exports.authRouter.get("/me", authenticate, (req, res) => {
    res.json({
        subject: req.auth?.subject,
        role: req.auth?.role
    });
});
