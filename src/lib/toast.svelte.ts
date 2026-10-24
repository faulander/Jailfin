export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

let nextId = 1;

class Toasts {
  items = $state<Toast[]>([]);

  show(
    message: string,
    options: { tone?: Toast["tone"]; action?: Toast["action"]; duration?: number } = {},
  ) {
    const toast: Toast = {
      id: nextId++,
      message,
      tone: options.tone ?? "info",
      action: options.action,
    };
    this.items = [...this.items.slice(-2), toast];
    setTimeout(() => this.dismiss(toast.id), options.duration ?? (toast.action ? 7000 : 4500));
  }

  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new Toasts();
