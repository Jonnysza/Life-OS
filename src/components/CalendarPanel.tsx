"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Plus, X } from "lucide-react";
import { useStore, useEventsFor } from "@/lib/store";
import { toDateKey } from "@/lib/utils";

export function CalendarPanel() {
  const [cursor, setCursor] = useState(new Date());
  const selectedDate = useStore((s) => s.selectedDate);
  const setSelectedDate = useStore((s) => s.setSelectedDate);
  const todos = useStore((s) => s.todos);
  const events = useStore((s) => s.events);
  const addEvent = useStore((s) => s.addEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);

  const todaysEvents = useEventsFor(selectedDate);
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [showAddEvent, setShowAddEvent] = useState(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const activity = useMemo(() => {
    const m = new Map<string, { todos: number; done: number; events: number }>();
    for (const t of todos) {
      const e = m.get(t.date) ?? { todos: 0, done: 0, events: 0 };
      e.todos++;
      if (t.done) e.done++;
      m.set(t.date, e);
    }
    for (const ev of events) {
      const e = m.get(ev.date) ?? { todos: 0, done: 0, events: 0 };
      e.events++;
      m.set(ev.date, e);
    }
    return m;
  }, [todos, events]);

  function submitEvent() {
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle.trim(),
      date: selectedDate,
      time: eventTime || undefined,
    });
    setEventTitle("");
    setEventTime("");
    setShowAddEvent(false);
  }

  return (
    <section className="glass rounded-2xl p-5 flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--muted)] uppercase">
          <CalIcon size={14} />
          {format(cursor, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="w-7 h-7 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => {
              setCursor(new Date());
              setSelectedDate(toDateKey(new Date()));
            }}
            className="px-2 py-1 text-xs rounded-md hover:bg-[var(--surface-2)]"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="w-7 h-7 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-[var(--muted)] uppercase tracking-wider">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const key = toDateKey(d);
          const isSelected = key === selectedDate;
          const inMonth = isSameMonth(d, cursor);
          const a = activity.get(key);
          const completion = a && a.todos > 0 ? a.done / a.todos : 0;
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              className={`aspect-square relative rounded-lg flex flex-col items-center justify-center text-xs transition
                ${isSelected ? "bg-[var(--accent)] text-white" : ""}
                ${!isSelected && inMonth ? "hover:bg-[var(--surface-2)]" : ""}
                ${!inMonth ? "text-[var(--muted)] opacity-40" : ""}
                ${isToday(d) && !isSelected ? "ring-1 ring-[var(--accent)]" : ""}
              `}
            >
              <span className="font-medium">{format(d, "d")}</span>
              {(a?.todos || a?.events) ? (
                <div className="absolute bottom-1 flex gap-0.5">
                  {a.events ? (
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{ background: isSelected ? "white" : "var(--accent-2)" }}
                    />
                  ) : null}
                  {a.todos ? (
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{
                        background: isSelected
                          ? "white"
                          : completion === 1
                            ? "var(--success)"
                            : "var(--muted)",
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
            Events
          </h3>
          <button
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="w-6 h-6 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center"
          >
            {showAddEvent ? <X size={12} /> : <Plus size={12} />}
          </button>
        </div>

        {showAddEvent && (
          <div className="slide-up flex gap-1.5 p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
            <input
              autoFocus
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitEvent()}
              placeholder="Event…"
              className="flex-1 bg-transparent text-sm px-2 placeholder:text-[var(--muted)]"
            />
            <input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className="w-24 bg-[var(--surface)] text-xs px-2 rounded-md border border-[var(--border)]"
            />
            <button
              onClick={submitEvent}
              className="px-2 rounded-md bg-[var(--accent)] text-white text-xs"
            >
              Add
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1 overflow-y-auto scroll-hidden -mr-2 pr-2 flex-1 min-h-0">
          {todaysEvents.length === 0 && !showAddEvent && (
            <p className="text-xs text-[var(--muted)] py-4 text-center">
              No events on this day.
            </p>
          )}
          {todaysEvents
            .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
            .map((e) => (
              <div
                key={e.id}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] pop"
              >
                <span
                  className="w-1 self-stretch rounded-full"
                  style={{ background: e.color ?? "var(--accent-2)" }}
                />
                {e.time && (
                  <span className="text-xs text-[var(--muted)] font-mono w-12">
                    {e.time}
                  </span>
                )}
                <span className="text-sm flex-1">{e.title}</span>
                <button
                  onClick={() => deleteEvent(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--danger)]"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
