"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/review/notificationActions";
import type { NotificationRow } from "@/lib/reviewer/notifications";
import { reviewHref } from "@/lib/reviewer/paths";

export default function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationRow[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);

  async function openNotification(n: NotificationRow) {
    setOpen(false);
    if (!n.read) {
      setNotifications((rows) => rows.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
      setUnread((c) => Math.max(0, c - 1));
      await markNotificationReadAction(n.id);
    }
    if (n.href) router.push(n.href);
  }

  async function markAllRead() {
    setNotifications((rows) => rows.map((r) => ({ ...r, read: true })));
    setUnread(0);
    await markAllNotificationsReadAction();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative rounded-full p-2 text-ink/70 hover:bg-ink/5 hover:text-forest"
      >
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-maroon px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-lg border border-ink/12 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-forest">
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink/50">Nothing yet.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={`block w-full px-4 py-3 text-left text-sm hover:bg-cream ${
                        n.read ? "text-ink/60" : "font-semibold text-ink"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-forest" />}
                        <span>
                          {n.title}
                          <span className="mt-0.5 block text-xs font-normal text-ink/40">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-ink/10 px-4 py-2 text-center">
              <Link href={reviewHref("")} onClick={() => setOpen(false)} className="text-xs font-semibold text-forest">
                Go to dashboard
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
