import axios from 'axios'

/**
 * Extracts a user-facing error message from an unknown thrown value.
 * - AxiosError with a response body: use backend's message field
 * - AxiosError with no response (network down): use network error message
 * - Anything else: use the fallback
 */
export function getErrorMessage(err: unknown, fallback = '操作失败，请稍后重试'): string {
  if (!axios.isAxiosError(err)) return fallback

  if (err.response) {
    return err.response.data.message ?? fallback
  }

  if (err.request) {
    return '网络连接失败，请检查网络'
  }

  return fallback
}
