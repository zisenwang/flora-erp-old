import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

import { errorHandler } from './middleware/errorHandler'
import authRouter from './routes/auth'
import dashboardRouter from './routes/dashboard'
import suppliersRouter from './routes/suppliers'
import customersRouter from './routes/customers'
import productsRouter from './routes/products'
import purchaseRouter from './routes/purchase'
import salesRouter from './routes/sales'
import inventoryRouter from './routes/inventory'
import lossRouter from './routes/loss'
import reportsRouter from './routes/reports'
import paymentsRouter from './routes/payments'
import settingsRouter from './routes/settings'

const app = express()

app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/customers', customersRouter)
app.use('/api/products', productsRouter)
app.use('/api/purchase', purchaseRouter)
app.use('/api/sales', salesRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/loss', lossRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/settings', settingsRouter)

app.use(errorHandler)

export default app
