import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSettings, type SystemSettings } from '@/api/settings.ts'
import { COMPANY_NAME, COMPANY_ADDRESS, COMPANY_PHONE } from '@/constants/company.ts'

const DEFAULTS: SystemSettings = {
  company_name: COMPANY_NAME,
  company_address: COMPANY_ADDRESS,
  company_phone: COMPANY_PHONE,
  print_title: COMPANY_NAME,
}

interface SettingsContextValue {
  settings: SystemSettings
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  reload: async () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS)

  const load = async () => {
    try {
      const s = await getSettings()
      setSettings({ ...DEFAULTS, ...s })
    } catch {
      // API unavailable — keep defaults
    }
  }

  useEffect(() => { load() }, [])

  return (
    <SettingsContext.Provider value={{ settings, reload: load }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
