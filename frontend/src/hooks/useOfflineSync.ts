/**
 * useOfflineSync — Hook for offline-first answer saving.
 *
 * Strategy:
 * 1. Save to IndexedDB immediately (instant, offline-safe)
 * 2. Try API call in background
 * 3. On API failure, mark as unsynced for later retry
 * 4. On reconnect, sync all unsynced answers
 */

import { useCallback, useEffect, useRef } from 'react'
import {
  saveAnswerOffline,
  getOfflineAnswers,
  syncOfflineAnswers,
} from '../utils/offlineDb'
import api from '../api/client'

interface UseOfflineSyncOptions {
  examId: number
  enabled?: boolean
}

export function useOfflineSync({ examId, enabled = true }: UseOfflineSyncOptions) {
  const isOnline = useRef(navigator.onLine)
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true
      // Trigger sync when coming back online
      if (enabled) {
        syncOfflineAnswers(examId, api.post.bind(api)).catch(() => {})
      }
    }
    const handleOffline = () => {
      isOnline.current = false
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [examId, enabled])

  // Periodic sync attempt (every 30s when online)
  useEffect(() => {
    if (!enabled) return

    syncTimer.current = setInterval(() => {
      if (isOnline.current) {
        syncOfflineAnswers(examId, api.post.bind(api)).catch(() => {})
      }
    }, 30000)

    return () => {
      if (syncTimer.current) clearInterval(syncTimer.current)
    }
  }, [examId, enabled])

  /**
   * Save an answer — offline-first.
   * Saves to IndexedDB immediately, then tries API.
   */
  const saveAnswer = useCallback(
    async (
      questionId: number,
      answer: { selected_answer_id?: number; selected_answer_ids?: number[]; text_answer?: string }
    ) => {
      // 1. Always save to IndexedDB first
      await saveAnswerOffline(examId, questionId, answer)

      // 2. Try API if online
      if (isOnline.current) {
        try {
          await api.post(`/api/v1/exams/${examId}/autosave`, {
            answers: [{ exam_form_question_id: questionId, ...answer }],
          })
        } catch {
          // API failed — answer is safe in IndexedDB, will sync later
        }
      }
    },
    [examId]
  )

  /**
   * Load saved answers from IndexedDB (for restoration on page reload).
   */
  const loadOfflineAnswers = useCallback(async () => {
    return getOfflineAnswers(examId)
  }, [examId])

  /**
   * Force sync all unsynced answers now.
   */
  const forceSync = useCallback(async () => {
    return syncOfflineAnswers(examId, api.post.bind(api))
  }, [examId])

  return {
    saveAnswer,
    loadOfflineAnswers,
    forceSync,
    isOnline: isOnline.current,
  }
}
