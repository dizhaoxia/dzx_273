import { atom } from 'jotai';
import type { Toast, ConnectionStatus, CollabUser } from '../types';

export const toastsAtom = atom<Toast[]>([]);

export const connectionStatusAtom = atom<ConnectionStatus>('connecting');

export const lastSyncTimeAtom = atom<number>(Date.now());

export const documentNameAtom = atom<string>('Untitled Spreadsheet');

export const localUserAtom = atom<CollabUser | null>(null);

export function createAddToast(setToasts: (updater: (prev: Toast[]) => Toast[]) => void) {
  return (toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };
}
