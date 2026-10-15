import { useState, useEffect } from 'react';
import type { Trade } from './types';

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
  isTodayCompleted: boolean;
  finalizedDays: Set<string>;
}

export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function getPreviousDay(d: Date): Date {
  const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  prev.setDate(prev.getDate() - 1);
  return prev;
}

function getPreviousBusinessDay(d: Date): Date {
  let prev = getPreviousDay(d);
  while (isWeekend(prev)) {
    prev = getPreviousDay(prev);
  }
  return prev;
}

export function getFinalizedDaysSet(): Set<string> {
  const set = new Set<string>();
  if (typeof window === 'undefined') return set;
  try {
    const raw = localStorage.getItem('tradelog_finalized_days');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(d => {
          if (typeof d === 'string') set.add(d);
        });
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tradelog_finalized_') && key !== 'tradelog_finalized_days') {
        const dateStr = key.replace('tradelog_finalized_', '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && localStorage.getItem(key) === 'true') {
          set.add(dateStr);
        }
      }
    }
  } catch (e) {
    console.error('Error loading finalized days:', e);
  }
  return set;
}

export function setDayFinalized(dateStr: string, finalized: boolean = true) {
  if (typeof window === 'undefined') return;
  try {
    const key = `tradelog_finalized_${dateStr}`;
    const set = getFinalizedDaysSet();
    if (finalized) {
      localStorage.setItem(key, 'true');
      set.add(dateStr);
    } else {
      localStorage.removeItem(key);
      set.delete(dateStr);
    }
    localStorage.setItem('tradelog_finalized_days', JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent('tradelog-streak-update', { detail: { date: dateStr, finalized } }));
  } catch (e) {
    console.error('Error saving finalized day:', e);
  }
}

export function calculateStreak(trades: Trade[]): StreakInfo {
  const finalizedSet = getFinalizedDaysSet();
  const today = new Date();
  const todayStr = formatDate(today);

  // A day is completed if:
  // 1. User operated (at least 1 trade)
  // 2. OR user finalized the day (even with 0 operations)
  const isCompleted = (dStr: string) => {
    return finalizedSet.has(dStr) || trades.some(t => t.date === dStr);
  };

  const isTodayDone = isCompleted(todayStr);

  let currentStreak = 0;

  if (isWeekend(today)) {
    // If today is weekend and was completed (e.g. study or weekend trading), include it
    let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (isCompleted(formatDate(cursor))) {
      currentStreak++;
      cursor = getPreviousDay(cursor);
    } else {
      // Weekends do not break the streak! Start measuring from last Friday
      cursor = getPreviousBusinessDay(today);
    }

    // Step backwards through business days
    while (true) {
      while (isWeekend(cursor)) {
        cursor = getPreviousDay(cursor);
      }
      const cStr = formatDate(cursor);
      if (isCompleted(cStr)) {
        currentStreak++;
        cursor = getPreviousBusinessDay(cursor);
      } else {
        break;
      }
    }
  } else {
    // Weekday (Monday to Friday)
    if (isTodayDone) {
      currentStreak = 1;
      let cursor = getPreviousBusinessDay(today);
      while (true) {
        const cStr = formatDate(cursor);
        if (isCompleted(cStr)) {
          currentStreak++;
          cursor = getPreviousBusinessDay(cursor);
        } else {
          break;
        }
      }
    } else {
      // Today is pending (not yet finished, but hasn't broken streak yet)
      const prevBusinessDay = getPreviousBusinessDay(today);
      const prevStr = formatDate(prevBusinessDay);

      if (isCompleted(prevStr)) {
        // Count previous streak (waiting for today's closure/trade)
        let cursor = prevBusinessDay;
        while (true) {
          const cStr = formatDate(cursor);
          if (isCompleted(cStr)) {
            currentStreak++;
            cursor = getPreviousBusinessDay(cursor);
          } else {
            break;
          }
        }
      } else {
        // Previous business day was missed
        currentStreak = 0;
      }
    }
  }

  // Calculate best historical streak
  const activeDaysSet = new Set<string>();
  trades.forEach(t => activeDaysSet.add(t.date));
  finalizedSet.forEach(d => activeDaysSet.add(d));

  let bestStreak = currentStreak;
  if (activeDaysSet.size > 0) {
    const sortedDates = Array.from(activeDaysSet).sort();
    const earliestParts = sortedDates[0].split('-').map(Number);
    const earliestDate = new Date(earliestParts[0], earliestParts[1] - 1, earliestParts[2]);

    let cursor = new Date(earliestDate);
    let tempStreak = 0;

    while (cursor <= today) {
      if (!isWeekend(cursor)) {
        const cStr = formatDate(cursor);
        if (isCompleted(cStr)) {
          tempStreak++;
          if (tempStreak > bestStreak) {
            bestStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return {
    currentStreak,
    bestStreak,
    isTodayCompleted: isTodayDone,
    finalizedDays: finalizedSet,
  };
}

export function useStreak(trades: Trade[]): StreakInfo {
  const [streak, setStreak] = useState<StreakInfo>(() => calculateStreak(trades));

  useEffect(() => {
    setStreak(calculateStreak(trades));

    const handleUpdate = () => {
      setStreak(calculateStreak(trades));
    };

    window.addEventListener('tradelog-streak-update', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('tradelog-streak-update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [trades]);

  return streak;
}
