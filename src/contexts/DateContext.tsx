import React, { createContext, useContext, useState, ReactNode } from 'react';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, setMonth, setYear } from 'date-fns';

interface DateContextType {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  startDate: Date;
  endDate: Date;
  changeMonth: (offset: number) => void;
  isAllMonths: boolean;
  setIsAllMonths: (val: boolean) => void;
  isAllYears: boolean;
  setIsAllYears: (val: boolean) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAllMonths, setIsAllMonths] = useState(false);
  const [isAllYears, setIsAllYears] = useState(false);

  const startDate = isAllYears 
    ? new Date(2000, 0, 1, 0, 0, 0, 0)
    : isAllMonths 
      ? startOfYear(selectedDate) 
      : startOfMonth(selectedDate);

  const endDate = isAllYears 
    ? new Date(2099, 11, 31, 23, 59, 59, 999)
    : isAllMonths 
      ? endOfYear(selectedDate) 
      : endOfMonth(selectedDate);

  const changeMonth = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
  };

  return (
    <DateContext.Provider value={{ selectedDate, setSelectedDate, startDate, endDate, changeMonth, isAllMonths, setIsAllMonths, isAllYears, setIsAllYears }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  const context = useContext(DateContext);
  if (context === undefined) {
    throw new Error('useDate must be used within a DateProvider');
  }
  return context;
}
