import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { DayTrackerState } from '../types';

interface CalendarProps {
  weekStart: string | null;
  weekData: DayTrackerState[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function Calendar({ weekStart, weekData, selectedDate, onSelectDate }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();

  const planDates = weekData.map(d => d.date);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rows: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    rows.push(week);
  }

  const getDayData = (date: Date): DayTrackerState | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return weekData.find(d => d.date === dateStr);
  };

  const isToday = (date: Date) => isSameDay(date, today);
  const isSelected = (date: Date) => selectedDate === format(date, 'yyyy-MM-dd');

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden card-glow">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated transition-colors text-secondary font-bold">
          ‹
        </button>
        <h3 className="font-display font-bold text-primary">{format(currentMonth, 'MMMM yyyy')}</h3>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated transition-colors text-secondary font-bold">
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center py-2 text-xs font-semibold font-sans text-dimmed">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="divide-y divide-border/30">
        {rows.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date, di) => {
              const inMonth = isSameMonth(date, currentMonth);
              const plan = isDayPlanDay(date, planDates);
              const dayData = getDayData(date);
              const todayDay = isToday(date);
              const selectedDay = isSelected(date);

              return (
                <div
                  key={di}
                  onClick={() => plan ? onSelectDate(format(date, 'yyyy-MM-dd')) : undefined}
                  className={`relative flex flex-col items-center py-1.5 min-h-[52px] transition-colors ${
                    plan ? 'cursor-pointer' : 'cursor-default'
                  } ${selectedDay ? 'bg-elevated' : todayDay ? 'bg-accent/10' : plan ? 'hover:bg-elevated/50' : ''}`}
                >
                  <span className={`text-sm font-sans font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                    !inMonth ? 'text-dimmed/40' :
                    selectedDay ? 'text-primary font-bold border border-accent' :
                    todayDay ? 'text-accent font-bold' :
                    plan ? 'text-primary' : 'text-dimmed'
                  }`}>
                    {format(date, 'd')}
                  </span>

                  {/* Meal dots */}
                  {plan && dayData && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayData.meals.map((meal, mi) => (
                        <div
                          key={mi}
                          className={`w-1.5 h-1.5 rounded-full ${
                            meal.eaten ? 'bg-success' : selectedDay ? 'bg-primary/20' : 'bg-dimmed/40'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Violet underline for plan days */}
                  {plan && !selectedDay && (
                    <div className="absolute bottom-0.5 w-3 h-0.5 bg-violet/40 rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-border">
        <LegendItem color="bg-accent/30" label="Today" />
        <LegendItem color="bg-elevated border border-accent/50" label="Selected" />
        <LegendItem color="bg-violet/30" label="Plan Day" />
        <LegendItem color="bg-success" label="Meal Eaten" dot />
      </div>
    </div>
  );
}

function isDayPlanDay(date: Date, planDates: string[]): boolean {
  return planDates.includes(format(date, 'yyyy-MM-dd'));
}

function LegendItem({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`${dot ? 'w-2.5 h-2.5 rounded-full' : 'w-3.5 h-3.5 rounded'} ${color}`} />
      <span className="text-xs text-secondary font-sans">{label}</span>
    </div>
  );
}
