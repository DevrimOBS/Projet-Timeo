import { Router } from "express";
import { authenticate } from "../../common/auth";

export const authRouter = Router();

authRouter.get("/me", authenticate, (req, res) => {
  res.json({
    subject: req.auth?.subject,
    role: req.auth?.role
  });
});
