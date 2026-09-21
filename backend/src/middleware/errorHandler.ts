import fs from 'fs'
import path from 'path'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '@/services/supplier.service'

function logError(req: Request, err: unknown) {
  const logDir = path.join(__dirname, '../../logs')
  fs.mkdirSync(logDir, { recursive: true })
  const logFile = path.join(logDir, 'error.log')
  const timestamp = new Date().toISOString()
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? (err.stack ?? '') : ''
  const line = `[${timestamp}] ${req.method} ${req.originalUrl}\n${message}\n${stack}\n\n`
  fs.appendFileSync(logFile, line)
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message })
    return
  }
  logError(req, err)
  console.error(err)
  res.status(500).json({ message: '服务器内部错误' })
}
