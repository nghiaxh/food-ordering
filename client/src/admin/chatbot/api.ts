import http from '@/shared/api/http'
import type { ChatHistoryMessage, KnowledgeChunkView, KnowledgeDoc, KnowledgeStats, AiSetting } from '@/shared/types'

export const adminGetChatHistory = () => http.get<ChatHistoryMessage[]>('/admin/chatbot/history').then((r) => r.data)

export const adminGetSettings = () => http.get<{ settingKey: string; settingValue: string }[]>('/admin/chatbot/settings').then((r) => r.data)

export const adminSaveSetting = (settingKey: string, settingValue: string) =>
  http.put('/admin/chatbot/settings', { settingKey, settingValue })

export const adminGetDocuments = () => http.get<KnowledgeDoc[]>('/admin/chatbot/documents').then((r) => r.data)

export const adminGetDocumentStats = () => http.get<KnowledgeStats>('/admin/chatbot/documents/stats').then((r) => r.data)

export const adminGetDocumentChunks = (id: number) =>
  http.get<KnowledgeChunkView[]>(`/admin/chatbot/documents/${id}/chunks`).then((r) => r.data)

export const adminSaveDocument = (id: number | null, data: object) =>
  id
    ? http.put<KnowledgeDoc>(`/admin/chatbot/documents/${id}`, data).then((r) => r.data)
    : http.post<KnowledgeDoc>('/admin/chatbot/documents', data).then((r) => r.data)

export const adminDeleteDocument = (id: number) => http.delete(`/admin/chatbot/documents/${id}`)

export const adminUploadDocument = (file: File, title: string, category: string, keywords: string) => {
  const form = new FormData()
  form.append('file', file)
  if (title.trim()) form.append('title', title.trim())
  if (category.trim()) form.append('category', category.trim())
  if (keywords.trim()) form.append('keywords', keywords.trim())
  return http.post<KnowledgeDoc>('/admin/chatbot/documents/upload', form).then((r) => r.data)
}

export const adminReingestDocument = (id: number) =>
  http.post<KnowledgeDoc>(`/admin/chatbot/documents/${id}/reingest`, {}).then((r) => r.data)

export type { AiSetting }