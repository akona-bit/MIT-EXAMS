/**
 * IndexedDB wrapper for offline exam answer storage.
 * Uses 'idb' library for a clean async API.
 *
 * Schema:
 *   answers: { examId, questionId, answer, timestamp, synced }
 *   exams: { examId, examData, expiresAt }
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'mit-exams-offline'
const DB_VERSION = 1

interface OfflineAnswer {
  examId: number
  questionId: number
  answer: { selected_answer_id?: number; selected_answer_ids?: number[]; text_answer?: string }
  timestamp: number
  synced: boolean
}

interface OfflineExamMeta {
  examId: number
  examData: any
  expiresAt: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Answers store — indexed by examId for quick lookup
        if (!db.objectStoreNames.contains('answers')) {
          const answerStore = db.createObjectStore('answers', {
            keyPath: ['examId', 'questionId'],
          })
          answerStore.createIndex('by_exam', 'examId')
          answerStore.createIndex('by_sync', 'synced')
        }
        // Exam metadata store
        if (!db.objectStoreNames.contains('exams')) {
          db.createObjectStore('exams', { keyPath: 'examId' })
        }
      },
    })
  }
  return dbPromise
}

// ─── Answer Operations ────────────────────────────────────────────────

export async function saveAnswerOffline(
  examId: number,
  questionId: number,
  answer: OfflineAnswer['answer']
): Promise<void> {
  const db = await getDB()
  await db.put('answers', {
    examId,
    questionId,
    answer,
    timestamp: Date.now(),
    synced: false,
  })
}

export async function getOfflineAnswers(examId: number): Promise<Map<number, OfflineAnswer['answer']>> {
  const db = await getDB()
  const tx = db.transaction('answers', 'readonly')
  const index = tx.store.index('by_exam')
  const results = await index.getAll(examId)

  const map = new Map<number, OfflineAnswer['answer']>()
  for (const r of results) {
    map.set(r.questionId, r.answer)
  }
  return map
}

export async function getUnsyncedAnswers(examId: number): Promise<OfflineAnswer[]> {
  const db = await getDB()
  const tx = db.transaction('answers', 'readonly')
  const index = tx.store.index('by_exam')
  const all = await index.getAll(examId)
  return all.filter((r) => !r.synced)
}

export async function markAnswerSynced(examId: number, questionId: number): Promise<void> {
  const db = await getDB()
  const existing = await db.get('answers', [examId, questionId])
  if (existing) {
    await db.put('answers', { ...existing, synced: true })
  }
}

export async function clearExamAnswers(examId: number): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('answers', 'readwrite')
  const index = tx.store.index('by_exam')
  const keys = await index.getAllKeys(examId)
  for (const key of keys) {
    await tx.store.delete(key)
  }
  await tx.done
}

// ─── Exam Meta Operations ─────────────────────────────────────────────

export async function saveExamMeta(examId: number, examData: any, ttlMinutes: number = 180): Promise<void> {
  const db = await getDB()
  await db.put('exams', {
    examId,
    examData,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  })
}

export async function getExamMeta(examId: number): Promise<OfflineExamMeta | null> {
  const db = await getDB()
  const meta = await db.get('exams', examId)
  if (meta && meta.expiresAt > Date.now()) {
    return meta
  }
  return null
}

// ─── Sync Helper ──────────────────────────────────────────────────────

export async function syncOfflineAnswers(
  examId: number,
  apiPost: (url: string, data: any) => Promise<any>
): Promise<{ synced: number; failed: number }> {
  const unsynced = await getUnsyncedAnswers(examId)
  let synced = 0
  let failed = 0

  for (const item of unsynced) {
    try {
      await apiPost(`/api/v1/exams/${examId}/autosave`, {
        answers: [{ exam_form_question_id: item.questionId, ...item.answer }],
      })
      await markAnswerSynced(examId, item.questionId)
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
