/**
 * Cross-tab announcements on BroadcastChannel('akshi') (SPEC_B_WEB.md §2.3).
 * Incoming messages are validated before use.
 */
import { z } from 'zod';

export const CHANNEL_NAME = 'akshi';

export const BroadcastMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('scan'), id: z.string().min(1) }),
  z.object({ type: z.literal('statement'), id: z.string().min(1) }),
  z.object({ type: z.literal('blocklist') }),
  z.object({ type: z.literal('cleared') }),
]);
export type BroadcastMessage = z.infer<typeof BroadcastMessageSchema>;

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

type Listener = (msg: BroadcastMessage) => void;
const localListeners = new Set<Listener>();

/** Sends to other tabs and to listeners in this tab. */
export function broadcast(msg: BroadcastMessage): void {
  for (const l of localListeners) l(msg);
  try {
    getChannel()?.postMessage(msg);
  } catch {
    /* channel closed */
  }
}

/** Subscribes to messages from this tab and other tabs. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  localListeners.add(listener);
  const ch = getChannel();
  const onMessage = (ev: MessageEvent<unknown>) => {
    const parsed = BroadcastMessageSchema.safeParse(ev.data);
    if (parsed.success) listener(parsed.data);
  };
  ch?.addEventListener('message', onMessage);
  return () => {
    localListeners.delete(listener);
    ch?.removeEventListener('message', onMessage);
  };
}
