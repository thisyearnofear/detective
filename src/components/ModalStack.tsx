// src/components/ModalStack.tsx
'use client';

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import RoundTransition from './RoundTransition';
import ErrorCard from './ErrorCard';

export type ModalType = 'reveal' | 'error' | 'loading' | 'notification';

export interface ModalConfig {
  id: string;
  type: ModalType;
  props: Record<string, any>;
  autoClose?: number; // ms, 0 = no auto-close
  onClose?: () => void;
  zIndex?: number;
}

export interface ModalContextType {
  show: (type: ModalType, props: Record<string, any>, config?: { autoClose?: number; onClose?: () => void }) => string;
  hide: (id: string) => void;
  hideByType: (type: ModalType) => void;
  stack: ModalConfig[];
}

export const ModalContext = createContext<ModalContextType | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ModalConfig[]>([]);

  const show = useCallback(
    (type: ModalType, props: Record<string, any>, config?: { autoClose?: number; onClose?: () => void }) => {
      const id = `modal-${Date.now()}-${Math.random()}`;
      const autoClose = config?.autoClose ?? 0;

      const newModal: ModalConfig = {
        id,
        type,
        props,
        autoClose,
        onClose: config?.onClose,
        zIndex: 50 + stack.length * 10,
      };

      setStack((prev) => [...prev, newModal]);

      // Auto-close if configured
      if (autoClose > 0) {
        const timer = setTimeout(() => {
          hide(id);
          config?.onClose?.();
        }, autoClose);

        // Store timer on modal for cleanup
        (newModal as any)._autoCloseTimer = timer;
      }

      return id;
    },
    [stack.length]
  );

  const hide = useCallback((id: string) => {
    setStack((prev) => {
      const modal = prev.find((m) => m.id === id);
      if (modal && (modal as any)._autoCloseTimer) {
        clearTimeout((modal as any)._autoCloseTimer);
      }
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const hideByType = useCallback((type: ModalType) => {
    setStack((prev) => {
      // Clear timers for all modals of this type
      prev.forEach((modal) => {
        if (modal.type === type && (modal as any)._autoCloseTimer) {
          clearTimeout((modal as any)._autoCloseTimer);
        }
      });
      return prev.filter((m) => m.type !== type);
    });
  }, []);

  return (
    <ModalContext.Provider value={{ show, hide, hideByType, stack }}>
      {children}
      <ModalStackRenderer stack={stack} onClose={hide} />
    </ModalContext.Provider>
  );
}

/**
 * ModalStackRenderer - Renders all modals with proper z-index management
 */
function ModalStackRenderer({ stack, onClose }: { stack: ModalConfig[]; onClose: (id: string) => void }) {
  if (stack.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none">
      {stack.map((modal) => (
        <div
          key={modal.id}
          className="absolute inset-0 pointer-events-auto"
          style={{ zIndex: modal.zIndex }}
          role="dialog"
          aria-modal="true"
        >
          {/* Semi-transparent backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              // Allow dismiss on backdrop click (if not disabled)
              if (modal.props.dismissOnBackdrop !== false) {
                onClose(modal.id);
                modal.onClose?.();
              }
            }}
          />

          {/* Modal Content */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">
              {modal.type === 'reveal' && (
                <RoundTransition
                  isVisible={true}
                  phase="reveal"
                  reveals={modal.props.reveals}
                  stats={modal.props.stats}
                  nextRoundNumber={modal.props.nextRoundNumber}
                />
              )}

              {modal.type === 'error' && (
                <ErrorCard
                  {...modal.props}
                  message={modal.props.message || ''}
                  onDismiss={() => {
                    onClose(modal.id);
                    modal.onClose?.();
                  }}
                />
              )}

              {modal.type === 'loading' && (
                <div className="bg-slate-900 rounded-2xl p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
                  <p className="text-white">{modal.props.message || 'Loading...'}</p>
                </div>
              )}

              {modal.type === 'notification' && (
                <div className="bg-slate-900 rounded-2xl p-6 max-w-md text-center">
                  {modal.props.icon && <div className="text-4xl mb-2">{modal.props.icon}</div>}
                  {modal.props.title && <h3 className="text-white font-bold mb-2">{modal.props.title}</h3>}
                  {modal.props.message && <p className="text-gray-300">{modal.props.message}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
