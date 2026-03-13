export type UiToastType = 'success' | 'error' | 'warning' | 'info';

export type UiConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
};

export type UiConfirmRequest = UiConfirmOptions & {
  resolve: (ok: boolean) => void;
};

const TOAST_EVENT = 'ui:feedback:toast';
const CONFIRM_EVENT = 'ui:feedback:confirm';

export const UI_FEEDBACK_EVENTS = {
  TOAST_EVENT,
  CONFIRM_EVENT,
} as const;

export function uiToast(message: string, type: UiToastType = 'info', duration = 3800): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: {
        message: String(message || ''),
        type,
        duration,
      },
    })
  );
}

export function uiConfirm(options: UiConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(
      new CustomEvent(CONFIRM_EVENT, {
        detail: {
          ...options,
          resolve,
        } satisfies UiConfirmRequest,
      })
    );
  });
}

export function getErrorMessage(error: any, fallback = 'Ocurrió un error'): string {
  return String(
    error?.response?.data?.message
      || error?.response?.data?.error
      || error?.message
      || fallback
  );
}
