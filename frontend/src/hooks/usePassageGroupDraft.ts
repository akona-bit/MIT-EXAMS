import { useState, useEffect, useCallback } from 'react';
import { QuestionBulkUpdateItem } from '../api/passages';

const STORAGE_KEY_PREFIX = 'passage_draft_';

export interface PassageDraftState {
  id: string; // The draft ID
  public_code?: string; // If editing an existing passage
  passageContent: string;
  sourceAuthor: string;
  sourceTitle: string;
  questions: QuestionBulkUpdateItem[];
  currentStep: number;
  lastSavedAt?: number;
}

const getInitialState = (draftId: string): PassageDraftState => ({
  id: draftId,
  passageContent: '',
  sourceAuthor: '',
  sourceTitle: '',
  questions: [],
  currentStep: 0,
});

export const usePassageGroupDraft = (draftId: string) => {
  const key = `${STORAGE_KEY_PREFIX}${draftId}`;
  
  const [draft, setDraft] = useState<PassageDraftState>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse draft", e);
    }
    return getInitialState(draftId);
  });
  
  // Autosave
  useEffect(() => {
    const saveToLocal = () => {
      const stateToSave = { ...draft, lastSavedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(stateToSave));
    };
    
    const timeout = setTimeout(saveToLocal, 5000); // 5s debounce
    return () => clearTimeout(timeout);
  }, [draft, key]);
  
  const updateDraft = useCallback((updates: Partial<PassageDraftState>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);
  
  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
    setDraft(getInitialState(draftId));
  }, [draftId, key]);

  return { draft, updateDraft, clearDraft };
};
