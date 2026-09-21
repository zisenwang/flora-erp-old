import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto } from '@/dto/supplier.dto'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { AppError } from '@/services/supplier.service'

const SELECT = `SELECT id, code, name, phone, address, status FROM suppliers`

export async function findAll(search?: string): Promise<Supplier[]> {
  let sql = SELECT
  const params: unknown[] = []
  if (search) {
    sql += ' WHERE name LIKE ? OR code LIKE ?'
    params.push(`%${search}%`, `%${search}%`)
  }
  sql += ' ORDER BY code ASC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<Supplier>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<Supplier | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE id = ?`, [id])
  return rows.length ? rowToCamel<Supplier>(rows[0] as Record<string, unknown>) : null
}

export async function create(dto: CreateSupplierDto): Promise<Supplier> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO suppliers (code, name, phone, address) VALUES (?, ?, ?, ?)',
      [dto.code, dto.name, dto.phone ?? null, dto.address ?? null],
    )
    return findById(result.insertId) as Promise<Supplier>
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, '供应商编码已存在')
    throw err
  }
}

export async function update(id: number, dto: UpdateSupplierDto): Promise<Supplier | null> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE suppliers SET code=?, name=?, phone=?, address=?, status=? WHERE id=?',
      [dto.code, dto.name, dto.phone ?? null, dto.address ?? null, dto.status ?? 1, id],
    )
    if (result.affectedRows === 0) return null
    return findById(id)
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, '供应商编码已存在')
    throw err
  }
}

export async function getNextCode(): Promise<string> {
  const [allRows] = await pool.query<RowDataPacket[]>(
    'SELECT code FROM suppliers ORDER BY updated_at DESC',
  )
  const lastCode = Number(allRows[0]?.code ?? 0)
  const occupied = new Set(allRows.map((r: RowDataPacket) => String(r.code)))
  let candidate = lastCode + 1
  while (occupied.has(String(candidate))) candidate++
  return String(candidate)
}

export async function remove(id: number): Promise<boolean> {
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM suppliers WHERE id = ?', [id])
    return result.affectedRows > 0
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2')
      throw new AppError(409, '该供应商有关联数据，无法删除')
    throw err
  }
}
