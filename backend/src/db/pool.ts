import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  typeCast(field, next) {
    if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
      const val = field.string()
      return val === null ? null : parseFloat(val)
    }
    return next()
  },
})

export default pool
