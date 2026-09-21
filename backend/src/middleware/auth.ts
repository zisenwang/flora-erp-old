import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'flora_erp_secret'

export interface AuthRequest extends Request {
  user?: { id: number; username: string; role: string }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: '未授权' })
    return
  }

  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string }
    next()
  } catch {
    res.status(401).json({ message: 'Token无效或已过期' })
  }
}
