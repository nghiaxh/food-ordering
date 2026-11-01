export function apiErrorMessage(error: unknown): string | undefined {
  const value = error as
    | { response?: { data?: { message?: string } }; data?: { message?: string } }
    | undefined
  return value?.response?.data?.message ?? value?.data?.message
}