// src/hooks/useModal.ts
'use client';

import { useContext } from 'react';
import { ModalContext, ModalContextType } from '@/components/ModalStack';

export function useModal(): ModalContextType {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}
