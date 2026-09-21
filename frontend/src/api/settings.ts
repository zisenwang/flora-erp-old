import client from './client.ts'

export interface SystemSettings {
  company_name: string
  company_address: string
  company_phone: string
  print_title: string
}

export const getSettings = async (): Promise<SystemSettings> => {
  const res = await client.get<{ data: Record<string, string> }>('/settings')
  return res.data.data as unknown as SystemSettings
}

export const updateSettings = async (data: Partial<SystemSettings>): Promise<SystemSettings> => {
  const res = await client.put<{ data: Record<string, string> }>('/settings', data)
  return res.data.data as unknown as SystemSettings
}
