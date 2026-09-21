import pool from '@/db/pool'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export async function getAll(): Promise<Record<string, string>> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT `key`, `value` FROM system_settings')
  const map: Record<string, string> = {}
  for (const row of rows as RowDataPacket[]) {
    map[row.key as string] = row.value as string
  }
  return map
}

export async function upsert(key: string, value: string): Promise<void> {
  await pool.query<ResultSetHeader>(
    'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, value],
  )
}
