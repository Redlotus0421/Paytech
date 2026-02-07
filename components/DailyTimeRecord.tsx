import React, { useState, useEffect } from 'react';
import { User, UserRole, TimeEntry, EmployeeSchedule, PayrollCutoff, PayrollSummary } from '../types';
import { supabase } from '../services/supabaseClient';
import { storageService } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';
import { 
  Clock, 
  Check, 
  X, 
  Calendar, 
  DollarSign, 
  RefreshCw, 
  Loader2, 
  Plus,
  AlertCircle,
  CheckCircle,
  Download,
  FileSpreadsheet,
  Edit,
  Trash2
} from 'lucide-react';

interface DailyTimeRecordProps {
  user: User;
}

type DTRTab = 'time-in-out' | 'approvals' | 'schedules' | 'payroll';

export const DailyTimeRecord: React.FC<DailyTimeRecordProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<DTRTab>('time-in-out');
  const [isLoading, setIsLoading] = useState(false);
  
  // Time entries state
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<TimeEntry | null>(null);
  
  // Employee entries state (for admin real-time monitoring)
  const [entriesTab, setEntriesTab] = useState<'my' | 'employee'>(user.role === UserRole.ADMIN ? 'employee' : 'my');
  const [allEmployeeEntries, setAllEmployeeEntries] = useState<TimeEntry[]>([]);
  const [entriesDateFilter, setEntriesDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // User's schedule state
  const [mySchedule, setMySchedule] = useState<EmployeeSchedule[]>([]);
  
  // Approvals state (admin only)
  const [pendingEntries, setPendingEntries] = useState<TimeEntry[]>([]);
  
  // Schedules state
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [scheduleEffectiveDate, setScheduleEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [scheduleEndDate, setScheduleEndDate] = useState<string>('');
  const [quickApplyStartTime, setQuickApplyStartTime] = useState<string>('09:00');
  const [quickApplyEndTime, setQuickApplyEndTime] = useState<string>('18:00');
  
  // Payroll state
  const [cutoffs, setCutoffs] = useState<PayrollCutoff[]>([]);
  const [selectedCutoff, setSelectedCutoff] = useState<string>('');
  const [payrollSummaries, setPayrollSummaries] = useState<PayrollSummary[]>([]);
  const [showCutoffModal, setShowCutoffModal] = useState(false);
  const [newCutoff, setNewCutoff] = useState({ name: '', startDate: '', endDate: '' });
  const [editingCutoff, setEditingCutoff] = useState<PayrollCutoff | null>(null);
  
  // Employee details for hourly rate
  const [employeeDetails, setEmployeeDetails] = useState<Map<string, { monthlySalary: number; hourlyRate: number; autoCalculate: boolean }>>(new Map());

  const isAdmin = user.role === UserRole.ADMIN;

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'time-in-out') {
        await loadTimeEntries();
      } else if (activeTab === 'approvals' && isAdmin) {
        await loadPendingApprovals();
      } else if (activeTab === 'schedules' && isAdmin) {
        await loadEmployees();
      } else if (activeTab === 'payroll' && isAdmin) {
        await loadPayrollData();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadTimeEntries = async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    try {
      // Load entries from Supabase
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      const entries: TimeEntry[] = (data || []).map(mapTimeEntryFromDb);
      setTimeEntries(entries);
      
      // Find today's entry OR yesterday's entry that hasn't been clocked out (for night shifts)
      let activeEntry = entries.find(e => e.date === today);
      
      // If no today entry, check for yesterday's entry without clock out (overnight shift)
      if (!activeEntry) {
        const yesterdayEntry = entries.find(e => e.date === yesterday && !e.timeOut);
        if (yesterdayEntry) {
          activeEntry = yesterdayEntry;
        }
      }
      
      setTodayEntry(activeEntry || null);
      
      // Load user's schedule
      await loadMySchedule();
      
      // If admin, also load all employee entries for the selected date
      if (isAdmin) {
        await loadAllEmployeeEntries(entriesDateFilter);
      }
    } catch (err) {
      console.error('Error loading time entries:', err);
      // Fallback to localStorage
      const stored = localStorage.getItem('dtr_entries_' + user.id);
      if (stored) {
        const entries = JSON.parse(stored);
        setTimeEntries(entries);
        setTodayEntry(entries.find((e: TimeEntry) => e.date === today) || null);
      }
    }
  };

  const loadMySchedule = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('user_id', user.id)
        .lte('effective_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('effective_date', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const latestSchedules = new Map<number, any>();
        data.forEach((s: any) => {
          if (!latestSchedules.has(s.day_of_week)) {
            latestSchedules.set(s.day_of_week, s);
          }
        });
        
        const mappedSchedules = Array.from(latestSchedules.values()).map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime: s.end_time,
          isRestDay: s.is_rest_day,
          effectiveDate: s.effective_date,
          endDate: s.end_date
        }));
        
        setMySchedule(mappedSchedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek));
      } else {
        setMySchedule([]);
      }
    } catch (err) {
      console.error('Error loading my schedule:', err);
      setMySchedule([]);
    }
  };

  const loadAllEmployeeEntries = async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('date', date)
        .order('time_in', { ascending: true });
      
      if (error) throw error;
      
      setAllEmployeeEntries((data || []).map(mapTimeEntryFromDb));
    } catch (err) {
      console.error('Error loading all employee entries:', err);
      setAllEmployeeEntries([]);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .or('time_in_status.eq.pending,time_out_status.eq.pending')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      setPendingEntries((data || []).map(mapTimeEntryFromDb));
    } catch (err) {
      console.error('Error loading pending approvals:', err);
      // Fallback to localStorage
      const allEntries = getAllLocalEntries();
      setPendingEntries(allEntries.filter(e => 
        e.timeInStatus === 'pending' || e.timeOutStatus === 'pending'
      ));
    }
  };

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'active');
      
      if (error) throw error;
      
      const emps: User[] = (data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        storeId: u.store_id || u.storeId,
        status: u.status,
        permissions: u.permissions || []
      }));
      
      setEmployees(emps);
      
      if (emps.length > 0 && !selectedEmployee) {
        setSelectedEmployee(emps[0].id);
        await loadEmployeeSchedule(emps[0].id);
      }
      
      // Load employee salary details
      await loadEmployeeDetails();
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  const loadEmployeeSchedule = async (employeeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('user_id', employeeId)
        .lte('effective_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('effective_date', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Get the most recent schedule for each day
        const latestSchedules = new Map<number, any>();
        data.forEach((s: any) => {
          if (!latestSchedules.has(s.day_of_week)) {
            latestSchedules.set(s.day_of_week, s);
          }
        });
        
        const mappedSchedules = Array.from(latestSchedules.values()).map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime: s.end_time,
          isRestDay: s.is_rest_day,
          effectiveDate: s.effective_date,
          endDate: s.end_date
        }));
        
        // Fill in missing days with defaults
        const existingDays = new Set(mappedSchedules.map(s => s.dayOfWeek));
        for (let day = 0; day <= 6; day++) {
          if (!existingDays.has(day)) {
            mappedSchedules.push({
              id: uuidv4(),
              userId: employeeId,
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '18:00',
              isRestDay: day === 0,
              effectiveDate: today,
              endDate: undefined
            });
          }
        }
        
        setSchedules(mappedSchedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek));
        
        // Set the effective date from the most recent schedule
        if (data[0]?.effective_date) {
          setScheduleEffectiveDate(data[0].effective_date);
        }
        if (data[0]?.end_date) {
          setScheduleEndDate(data[0].end_date);
        } else {
          setScheduleEndDate('');
        }
      } else {
        // Create default schedule (Mon-Sat 9AM-6PM, Sun rest)
        const defaultSchedule: EmployeeSchedule[] = [0, 1, 2, 3, 4, 5, 6].map(day => ({
          id: uuidv4(),
          userId: employeeId,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          isRestDay: day === 0,
          effectiveDate: today,
          endDate: undefined
        }));
        setSchedules(defaultSchedule);
        setScheduleEffectiveDate(today);
        setScheduleEndDate('');
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
      // Default schedule
      const today = new Date().toISOString().split('T')[0];
      const defaultSchedule: EmployeeSchedule[] = [0, 1, 2, 3, 4, 5, 6].map(day => ({
        id: uuidv4(),
        userId: employeeId,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        isRestDay: day === 0,
        effectiveDate: today,
        endDate: undefined
      }));
      setSchedules(defaultSchedule);
      setScheduleEffectiveDate(today);
      setScheduleEndDate('');
    }
  };

  const loadEmployeeDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_details')
        .select('*');
      
      if (error) throw error;
      
      const details = new Map<string, { monthlySalary: number; hourlyRate: number; autoCalculate: boolean }>();
      (data || []).forEach((d: any) => {
        details.set(d.user_id, {
          monthlySalary: d.monthly_salary || 0,
          hourlyRate: d.hourly_rate || 0,
          autoCalculate: d.auto_calculate_rate !== false
        });
      });
      setEmployeeDetails(details);
    } catch (err) {
      console.error('Error loading employee details:', err);
    }
  };

  const loadPayrollData = async () => {
    try {
      const { data, error } = await supabase
        .from('payroll_cutoffs')
        .select('*')
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      
      const loadedCutoffs: PayrollCutoff[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
        createdAt: c.created_at,
        createdBy: c.created_by
      }));
      
      setCutoffs(loadedCutoffs);
      
      if (loadedCutoffs.length > 0) {
        setSelectedCutoff(loadedCutoffs[0].id);
        await loadPayrollSummary(loadedCutoffs[0].id);
      }
    } catch (err) {
      console.error('Error loading payroll data:', err);
    }
  };

  const loadPayrollSummary = async (cutoffId: string) => {
    const cutoff = cutoffs.find(c => c.id === cutoffId);
    if (!cutoff) return;
    
    try {
      // Get all approved entries within the cutoff period
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .gte('date', cutoff.startDate)
        .lte('date', cutoff.endDate)
        .eq('time_in_status', 'approved')
        .eq('time_out_status', 'approved');
      
      if (error) throw error;
      
      const entries = (data || []).map(mapTimeEntryFromDb);
      
      // Group by user
      const userEntries = new Map<string, TimeEntry[]>();
      entries.forEach(entry => {
        const existing = userEntries.get(entry.userId) || [];
        existing.push(entry);
        userEntries.set(entry.userId, existing);
      });
      
      // Calculate summaries
      const summaries: PayrollSummary[] = [];
      userEntries.forEach((userEntriesList, usrId) => {
        const totalHours = userEntriesList.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
        const details = employeeDetails.get(usrId);
        const hourlyRate = details?.hourlyRate || calculateHourlyRate(details?.monthlySalary || 0);
        
        summaries.push({
          id: uuidv4(),
          cutoffId,
          userId: usrId,
          userName: userEntriesList[0]?.userName || 'Unknown',
          totalHours,
          hourlyRate,
          grossPay: totalHours * hourlyRate,
          entries: userEntriesList
        });
      });
      
      setPayrollSummaries(summaries);
    } catch (err) {
      console.error('Error loading payroll summary:', err);
    }
  };

  // Helper functions
  const mapTimeEntryFromDb = (data: any): TimeEntry => ({
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    date: data.date,
    timeIn: data.time_in,
    timeOut: data.time_out,
    timeInStatus: data.time_in_status || 'pending',
    timeOutStatus: data.time_out_status || 'pending',
    hoursWorked: data.hours_worked,
    approvedBy: data.approved_by,
    approvedAt: data.approved_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  });

  const getAllLocalEntries = (): TimeEntry[] => {
    const entries: TimeEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dtr_entries_')) {
        const stored = localStorage.getItem(key);
        if (stored) {
          entries.push(...JSON.parse(stored));
        }
      }
    }
    return entries;
  };

  const calculateHourlyRate = (monthlySalary: number): number => {
    // Assuming 22 working days * 8 hours = 176 hours/month
    if (monthlySalary <= 0) return 0;
    return Math.round((monthlySalary / 176) * 100) / 100;
  };

  const formatTime = (time: string | undefined): string => {
    if (!time) return '--:-- --';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const getCurrentTime = (): string => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  };

  // Get the date for a specific day of week based on the effective date
  const getDateForDay = (dayOfWeek: number, effectiveDate: string): string => {
    const baseDate = new Date(effectiveDate);
    const baseDayOfWeek = baseDate.getDay(); // 0=Sunday, 6=Saturday
    
    // Calculate difference in days
    let diff = dayOfWeek - baseDayOfWeek;
    if (diff < 0) diff += 7; // Move to next week if day already passed
    
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + diff);
    
    return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Calculate hours worked - handles overnight shifts
  const calculateHours = (timeIn: string, timeOut: string, isOvernight: boolean = false): number => {
    const [inH, inM] = timeIn.split(':').map(Number);
    const [outH, outM] = timeOut.split(':').map(Number);
    
    let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    
    // If overnight shift (clock out time is less than clock in time, or explicitly overnight)
    if (totalMinutes < 0 || isOvernight) {
      // Add 24 hours (1440 minutes) for overnight calculation
      totalMinutes = (24 * 60) - (inH * 60 + inM) + (outH * 60 + outM);
    }
    
    return Math.round((totalMinutes / 60) * 100) / 100;
  };

  // Check if this is an overnight entry (entry date is different from today)
  const isOvernightEntry = (): boolean => {
    if (!todayEntry) return false;
    const today = new Date().toISOString().split('T')[0];
    return todayEntry.date !== today;
  };

  // Export payroll to CSV
  const exportPayrollToCSV = () => {
    if (payrollSummaries.length === 0) {
      alert('No payroll data to export');
      return;
    }

    const cutoff = cutoffs.find(c => c.id === selectedCutoff);
    const cutoffName = cutoff ? cutoff.name : 'Payroll';
    
    // Create CSV headers
    const headers = ['Employee', 'Total Hours', 'Hourly Rate (₱)', 'Gross Pay (₱)'];
    
    // Create CSV rows
    const rows = payrollSummaries.map(summary => [
      summary.userName,
      summary.totalHours.toFixed(2),
      summary.hourlyRate.toFixed(2),
      summary.grossPay.toFixed(2)
    ]);

    // Add totals row
    const totalHours = payrollSummaries.reduce((sum, s) => sum + s.totalHours, 0);
    const totalGrossPay = payrollSummaries.reduce((sum, s) => sum + s.grossPay, 0);
    rows.push(['TOTAL', totalHours.toFixed(2), '-', totalGrossPay.toFixed(2)]);

    // Convert to CSV string
    const csvContent = [
      `Payroll Report: ${cutoffName}`,
      `Period: ${cutoff?.startDate} to ${cutoff?.endDate}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_${cutoffName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export detailed payroll with individual entries
  const exportDetailedPayrollToCSV = () => {
    if (payrollSummaries.length === 0) {
      alert('No payroll data to export');
      return;
    }

    const cutoff = cutoffs.find(c => c.id === selectedCutoff);
    const cutoffName = cutoff ? cutoff.name : 'Payroll';
    
    // Create detailed CSV with all time entries
    const headers = ['Employee', 'Date', 'Time In', 'Time Out', 'Hours Worked', 'Status'];
    
    const rows: string[][] = [];
    payrollSummaries.forEach(summary => {
      if (summary.entries && summary.entries.length > 0) {
        summary.entries.forEach(entry => {
          rows.push([
            summary.userName,
            entry.date,
            entry.timeIn || '-',
            entry.timeOut || '-',
            entry.hoursWorked?.toFixed(2) || '0',
            entry.timeInStatus === 'approved' && entry.timeOutStatus === 'approved' ? 'Approved' : 'Pending'
          ]);
        });
        // Add subtotal row for each employee
        rows.push([`  Subtotal: ${summary.userName}`, '', '', '', summary.totalHours.toFixed(2), `₱${summary.grossPay.toFixed(2)}`]);
        rows.push(['', '', '', '', '', '']); // Empty row for spacing
      }
    });

    // Add grand totals
    const totalHours = payrollSummaries.reduce((sum, s) => sum + s.totalHours, 0);
    const totalGrossPay = payrollSummaries.reduce((sum, s) => sum + s.grossPay, 0);
    rows.push(['GRAND TOTAL', '', '', '', totalHours.toFixed(2), `₱${totalGrossPay.toFixed(2)}`]);

    const csvContent = [
      `Detailed Payroll Report: ${cutoffName}`,
      `Period: ${cutoff?.startDate} to ${cutoff?.endDate}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_detailed_${cutoffName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Actions
  const handleClockIn = async () => {
    const today = new Date().toISOString().split('T')[0];
    const currentTime = getCurrentTime();
    
    setIsLoading(true);
    try {
      const entry: TimeEntry = {
        id: uuidv4(),
        userId: user.id,
        userName: user.name,
        date: today,
        timeIn: currentTime,
        timeInStatus: 'pending',
        timeOutStatus: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Save to Supabase
      const { error } = await supabase.from('time_entries').insert([{
        id: entry.id,
        user_id: entry.userId,
        user_name: entry.userName,
        date: entry.date,
        time_in: entry.timeIn,
        time_in_status: entry.timeInStatus,
        time_out_status: entry.timeOutStatus,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt
      }]);
      
      if (error) throw error;
      
      // Log activity and notify admin
      await storageService.logActivity(
        'Clock In', 
        `${user.name} clocked in at ${formatTime(currentTime)} - Pending Approval`,
        user.id,
        user.name
      );
      
      setTodayEntry(entry);
      await loadTimeEntries();
      
      alert(`Clock In recorded at ${formatTime(currentTime)}. Waiting for admin approval.`);
    } catch (err) {
      console.error('Error clocking in:', err);
      // Fallback to localStorage
      const stored = localStorage.getItem('dtr_entries_' + user.id);
      const entries: TimeEntry[] = stored ? JSON.parse(stored) : [];
      const entry: TimeEntry = {
        id: uuidv4(),
        userId: user.id,
        userName: user.name,
        date: today,
        timeIn: currentTime,
        timeInStatus: 'pending',
        timeOutStatus: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      entries.unshift(entry);
      localStorage.setItem('dtr_entries_' + user.id, JSON.stringify(entries));
      setTodayEntry(entry);
      setTimeEntries(entries);
      alert(`Clock In recorded at ${formatTime(currentTime)}. Waiting for admin approval.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!todayEntry || !todayEntry.timeIn) return;
    
    const currentTime = getCurrentTime();
    const overnight = isOvernightEntry();
    const hoursWorked = calculateHours(todayEntry.timeIn, currentTime, overnight);
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          time_out: currentTime,
          time_out_status: 'pending',
          hours_worked: hoursWorked,
          updated_at: Date.now()
        })
        .eq('id', todayEntry.id);
      
      if (error) throw error;
      
      await storageService.logActivity(
        'Clock Out', 
        `${user.name} clocked out at ${formatTime(currentTime)} (${hoursWorked} hrs)${overnight ? ' [Overnight]' : ''} - Pending Approval`,
        user.id,
        user.name
      );
      
      setTodayEntry({ ...todayEntry, timeOut: currentTime, timeOutStatus: 'pending', hoursWorked });
      await loadTimeEntries();
      
      alert(`Clock Out recorded at ${formatTime(currentTime)}. Total hours: ${hoursWorked}. Waiting for admin approval.`);
    } catch (err) {
      console.error('Error clocking out:', err);
      // Fallback to localStorage
      const stored = localStorage.getItem('dtr_entries_' + user.id);
      const entries: TimeEntry[] = stored ? JSON.parse(stored) : [];
      const idx = entries.findIndex(e => e.id === todayEntry.id);
      if (idx !== -1) {
        entries[idx] = { ...entries[idx], timeOut: currentTime, timeOutStatus: 'pending', hoursWorked, updatedAt: Date.now() };
        localStorage.setItem('dtr_entries_' + user.id, JSON.stringify(entries));
        setTodayEntry(entries[idx]);
        setTimeEntries(entries);
      }
      alert(`Clock Out recorded at ${formatTime(currentTime)}. Total hours: ${hoursWorked}. Waiting for admin approval.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async (entryId: string, type: 'timeIn' | 'timeOut', approve: boolean) => {
    setIsLoading(true);
    try {
      const status = approve ? 'approved' : 'rejected';
      const updateData: any = {
        updated_at: Date.now()
      };
      
      if (type === 'timeIn') {
        updateData.time_in_status = status;
      } else {
        updateData.time_out_status = status;
      }
      
      if (approve) {
        updateData.approved_by = user.name;
        updateData.approved_at = Date.now();
      }
      
      const { error } = await supabase
        .from('time_entries')
        .update(updateData)
        .eq('id', entryId);
      
      if (error) throw error;
      
      const entry = pendingEntries.find(e => e.id === entryId);
      await storageService.logActivity(
        `${approve ? 'Approve' : 'Reject'} ${type === 'timeIn' ? 'Clock In' : 'Clock Out'}`,
        `${user.name} ${approve ? 'approved' : 'rejected'} ${entry?.userName}'s ${type === 'timeIn' ? 'clock in' : 'clock out'}`,
        user.id,
        user.name
      );
      
      await loadPendingApprovals();
    } catch (err) {
      console.error('Error updating approval:', err);
      alert('Failed to update approval status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedEmployee) return;
    if (!scheduleEffectiveDate) {
      alert('Please set an effective date for this schedule');
      return;
    }
    
    setIsLoading(true);
    try {
      // End date for existing schedules (day before the new effective date)
      const effectiveDate = new Date(scheduleEffectiveDate);
      const previousDay = new Date(effectiveDate);
      previousDay.setDate(previousDay.getDate() - 1);
      const endPreviousSchedules = previousDay.toISOString().split('T')[0];
      
      // Update existing schedules to end the day before the new effective date
      await supabase
        .from('employee_schedules')
        .update({ end_date: endPreviousSchedules, updated_at: Date.now() })
        .eq('user_id', selectedEmployee)
        .is('end_date', null)
        .lt('effective_date', scheduleEffectiveDate);
      
      // Insert new schedules
      const scheduleData = schedules.map(s => ({
        id: uuidv4(),
        user_id: selectedEmployee,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        is_rest_day: s.isRestDay,
        effective_date: scheduleEffectiveDate,
        end_date: scheduleEndDate || null,
        created_at: Date.now(),
        updated_at: Date.now()
      }));
      
      const { error } = await supabase
        .from('employee_schedules')
        .insert(scheduleData);
      
      if (error) throw error;
      
      await storageService.logActivity(
        'Update Schedule',
        `Updated schedule for employee effective ${scheduleEffectiveDate}${scheduleEndDate ? ` to ${scheduleEndDate}` : ''}`,
        user.id,
        user.name
      );
      
      alert('Schedule saved successfully!');
      await loadEmployeeSchedule(selectedEmployee);
    } catch (err) {
      console.error('Error saving schedule:', err);
      alert('Failed to save schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCutoff = async () => {
    if (!newCutoff.name || !newCutoff.startDate || !newCutoff.endDate) {
      alert('Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    try {
      if (editingCutoff) {
        // Update existing cutoff
        const { error } = await supabase
          .from('payroll_cutoffs')
          .update({
            name: newCutoff.name,
            start_date: newCutoff.startDate,
            end_date: newCutoff.endDate
          })
          .eq('id', editingCutoff.id);
        
        if (error) throw error;
        
        await storageService.logActivity(
          'Update Cutoff',
          `${user.name} updated cutoff period: ${newCutoff.name}`,
          user.id,
          user.name
        );
      } else {
        // Create new cutoff
        const cutoff: PayrollCutoff = {
          id: uuidv4(),
          name: newCutoff.name,
          startDate: newCutoff.startDate,
          endDate: newCutoff.endDate,
          status: 'active',
          createdAt: Date.now(),
          createdBy: user.name
        };
        
        const { error } = await supabase.from('payroll_cutoffs').insert([{
          id: cutoff.id,
          name: cutoff.name,
          start_date: cutoff.startDate,
          end_date: cutoff.endDate,
          status: cutoff.status,
          created_at: cutoff.createdAt,
          created_by: cutoff.createdBy
        }]);
        
        if (error) throw error;
        
        await storageService.logActivity(
          'Create Cutoff',
          `${user.name} created cutoff period: ${newCutoff.name}`,
          user.id,
          user.name
        );
      }
      
      setShowCutoffModal(false);
      setNewCutoff({ name: '', startDate: '', endDate: '' });
      setEditingCutoff(null);
      await loadPayrollData();
    } catch (err) {
      console.error('Error saving cutoff:', err);
      alert('Failed to save cutoff period');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCutoff = (cutoff: PayrollCutoff) => {
    setEditingCutoff(cutoff);
    setNewCutoff({
      name: cutoff.name,
      startDate: cutoff.startDate,
      endDate: cutoff.endDate
    });
    setShowCutoffModal(true);
  };

  const handleDeleteCutoff = async (cutoffId: string) => {
    const cutoff = cutoffs.find(c => c.id === cutoffId);
    if (!cutoff) return;
    
    if (!confirm(`Are you sure you want to delete the cutoff period "${cutoff.name}"? This action cannot be undone.`)) {
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('payroll_cutoffs')
        .delete()
        .eq('id', cutoffId);
      
      if (error) throw error;
      
      await storageService.logActivity(
        'Delete Cutoff',
        `${user.name} deleted cutoff period: ${cutoff.name}`,
        user.id,
        user.name
      );
      
      // Clear selection if the deleted cutoff was selected
      if (selectedCutoff === cutoffId) {
        setSelectedCutoff('');
        setPayrollSummaries([]);
      }
      
      await loadPayrollData();
    } catch (err) {
      console.error('Error deleting cutoff:', err);
      alert('Failed to delete cutoff period');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSchedule = (dayOfWeek: number, field: keyof EmployeeSchedule, value: any) => {
    setSchedules(prev => prev.map(s => 
      s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
    ));
  };

  const applyToAllWorkDays = () => {
    setSchedules(prev => prev.map(s => 
      s.isRestDay ? s : { ...s, startTime: quickApplyStartTime, endTime: quickApplyEndTime }
    ));
  };

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Tab navigation
  const tabs: { id: DTRTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'time-in-out', label: 'Time In/Out', icon: <Clock size={16} /> },
    { id: 'approvals', label: 'Approvals', icon: <Check size={16} />, adminOnly: true },
    { id: 'schedules', label: 'Schedules', icon: <Calendar size={16} />, adminOnly: true },
    { id: 'payroll', label: 'Payroll', icon: <DollarSign size={16} />, adminOnly: true }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daily Time Record</h1>
        <p className="text-gray-500">Track attendance and manage payroll</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-100 p-1 rounded-lg inline-flex gap-1">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Time In/Out Tab */}
      {activeTab === 'time-in-out' && (
        <div className="space-y-6">
          {/* Today's Attendance Card - Only for non-admin users */}
          {!isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Today's Attendance</h2>
              <p className="text-sm text-gray-500 mb-4">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              {/* Overnight shift indicator */}
              {todayEntry && isOvernightEntry() && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-700">
                    <span className="font-medium">🌙 Overnight Shift:</span> You clocked in on {todayEntry.date}. Clock out will be recorded for that entry.
                  </p>
                </div>
              )}
              
              <div className="flex gap-4">
                <button
                  onClick={handleClockIn}
                  disabled={isLoading || (todayEntry?.timeIn != null)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                    todayEntry?.timeIn
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                  }`}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Clock size={18} />}
                  Clock In
                </button>
                
                <button
                  onClick={handleClockOut}
                  disabled={isLoading || !todayEntry?.timeIn || todayEntry?.timeOut != null}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                    !todayEntry?.timeIn || todayEntry?.timeOut
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Clock size={18} />}
                  Clock Out
                </button>
              </div>
              
              {todayEntry && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Time In:</span>
                      <div className="font-medium">{formatTime(todayEntry.timeIn)}</div>
                      <StatusBadge status={todayEntry.timeInStatus} />
                    </div>
                    <div>
                      <span className="text-gray-500">Time Out:</span>
                      <div className="font-medium">{formatTime(todayEntry.timeOut)}</div>
                      {todayEntry.timeOut && <StatusBadge status={todayEntry.timeOutStatus} />}
                    </div>
                    {(todayEntry.hoursWorked !== undefined && todayEntry.hoursWorked !== null) && (
                      <div>
                        <span className="text-gray-500">Hours:</span>
                        <div className="font-medium">{todayEntry.hoursWorked} hrs</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent Entries and My Work Schedule Grid */}
          <div className={`grid grid-cols-1 ${!isAdmin ? 'lg:grid-cols-3' : ''} gap-6`}>
            {/* Recent Entries */}
            <div className={`${!isAdmin ? 'lg:col-span-2' : ''} bg-white rounded-xl shadow-sm border border-gray-200 p-6`}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{isAdmin ? 'Employee Entries' : 'Recent Entries'}</h2>
                  <p className="text-sm text-gray-500">View attendance records</p>
                </div>
                <button onClick={loadData} className="text-gray-500 hover:text-gray-700">
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              
              {/* Date filter for Employee Entries */}
              {isAdmin && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                  <input
                    type="date"
                    value={entriesDateFilter}
                    onChange={(e) => {
                      setEntriesDateFilter(e.target.value);
                      loadAllEmployeeEntries(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {isAdmin && (
                        <th className="text-left py-3 px-2 font-medium text-gray-600">Employee</th>
                      )}
                      {!isAdmin && (
                        <th className="text-left py-3 px-2 font-medium text-gray-600">Date</th>
                      )}
                      <th className="text-left py-3 px-2 font-medium text-gray-600">Time In</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-600">In Status</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-600">Time Out</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-600">Out Status</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-600">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* My Entries - Non-admin users */}
                    {!isAdmin && timeEntries.map(entry => (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="py-3 px-2">{entry.date}</td>
                        <td className="py-3 px-2">{formatTime(entry.timeIn)}</td>
                        <td className="py-3 px-2"><StatusBadge status={entry.timeInStatus} /></td>
                        <td className="py-3 px-2">{formatTime(entry.timeOut)}</td>
                        <td className="py-3 px-2">{entry.timeOut ? <StatusBadge status={entry.timeOutStatus} /> : <span className="text-gray-400">N/A</span>}</td>
                        <td className="py-3 px-2">{(entry.hoursWorked !== undefined && entry.hoursWorked !== null) ? `${entry.hoursWorked} hrs` : '-'}</td>
                      </tr>
                    ))}
                    {!isAdmin && timeEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">No entries found</td>
                      </tr>
                    )}
                    
                    {/* Employee Entries (Admin only) */}
                    {isAdmin && allEmployeeEntries.map(entry => (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="py-3 px-2 font-medium">{entry.userName}</td>
                        <td className="py-3 px-2">{formatTime(entry.timeIn)}</td>
                        <td className="py-3 px-2"><StatusBadge status={entry.timeInStatus} /></td>
                        <td className="py-3 px-2">{entry.timeOut ? formatTime(entry.timeOut) : '-'}</td>
                        <td className="py-3 px-2">{entry.timeOut ? <StatusBadge status={entry.timeOutStatus} /> : <span className="text-gray-400">N/A</span>}</td>
                        <td className="py-3 px-2">{(entry.hoursWorked !== undefined && entry.hoursWorked !== null) ? `${entry.hoursWorked} hrs` : '-'}</td>
                      </tr>
                    ))}
                    {isAdmin && allEmployeeEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">No employee entries for this date</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* My Work Schedule - Only for non-admin users */}
            {!isAdmin && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={20} className="text-gray-600" />
                  <h2 className="text-lg font-bold text-gray-900">My Work Schedule</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">Your assigned work schedule</p>
                
                {mySchedule.length > 0 ? (
                  <div className="space-y-2">
                    {mySchedule.map(schedule => (
                      <div 
                        key={schedule.dayOfWeek} 
                        className={`flex justify-between items-center p-3 rounded-lg ${
                          schedule.isRestDay 
                            ? 'bg-gray-50 text-gray-400' 
                            : schedule.dayOfWeek === new Date().getDay() 
                              ? 'bg-yellow-50 border border-yellow-200' 
                              : 'bg-gray-50'
                        }`}
                      >
                        <span className={`font-medium ${schedule.dayOfWeek === new Date().getDay() ? 'text-yellow-700' : ''}`}>
                          {getDayName(schedule.dayOfWeek)}
                        </span>
                        <span className={`text-sm ${schedule.isRestDay ? 'italic' : ''}`}>
                          {schedule.isRestDay 
                            ? 'Rest Day' 
                            : `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No schedule has been assigned yet.</p>
                    <p className="text-sm text-gray-400">Please contact your administrator.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approvals Tab (Admin Only) */}
      {activeTab === 'approvals' && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pending Approvals</h2>
              <p className="text-sm text-gray-500">Review and approve employee time entries</p>
            </div>
            <button onClick={loadData} className="text-gray-500 hover:text-gray-700">
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Employee</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Time In</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Clock In Action</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Time Out</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Clock Out Action</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Hours</th>
                </tr>
              </thead>
              <tbody>
                {pendingEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-gray-100">
                    <td className="py-3 px-2 font-medium">{entry.userName}</td>
                    <td className="py-3 px-2">{entry.date}</td>
                    <td className="py-3 px-2">
                      {formatTime(entry.timeIn)}
                    </td>
                    <td className="py-3 px-2">
                      {entry.timeInStatus === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproval(entry.id, 'timeIn', true)}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                            title="Approve Clock In"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproval(entry.id, 'timeIn', false)}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                            title="Reject Clock In"
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <StatusBadge status={entry.timeInStatus} />
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {entry.timeOut ? (
                        <div className="flex items-center gap-2">
                          {formatTime(entry.timeOut)}
                          <StatusBadge status={entry.timeOutStatus} />
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {entry.timeOut && entry.timeOutStatus === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproval(entry.id, 'timeOut', true)}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                            title="Approve Clock Out"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproval(entry.id, 'timeOut', false)}
                            disabled={isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                            title="Reject Clock Out"
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      ) : entry.timeOut ? (
                        <StatusBadge status={entry.timeOutStatus} />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-gray-600">
                        {entry.hoursWorked ? `${entry.hoursWorked} hrs` : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
                {pendingEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">No pending approvals</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedules Tab (Admin Only) */}
      {activeTab === 'schedules' && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Employee Schedules</h2>
          <p className="text-sm text-gray-500 mb-4">Set work schedules for employees with effective date range</p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                loadEmployeeSchedule(e.target.value);
              }}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          
          {/* Schedule Effective Period */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700">Schedule Effective Period</h3>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-600 mb-1">Effective From</label>
                <input
                  type="date"
                  value={scheduleEffectiveDate}
                  onChange={(e) => setScheduleEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-600 mb-1">Effective To</label>
                <input
                  type="date"
                  value={scheduleEndDate}
                  onChange={(e) => setScheduleEndDate(e.target.value)}
                  min={scheduleEffectiveDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {}}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                <Calendar size={16} />
                Apply Dates
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Current schedule is effective from {formatDateDisplay(scheduleEffectiveDate)}{scheduleEndDate ? ` until ${formatDateDisplay(scheduleEndDate)}` : ' (ongoing)'}
            </p>
          </div>
          
          {/* Quick Apply - Same Time for All Work Days */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-700">Quick Apply - Same Time for All Work Days</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">Set start and end times below, then click "Apply to All Work Days" to update all non-rest days at once.</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                <input
                  type="time"
                  value={quickApplyStartTime}
                  onChange={(e) => setQuickApplyStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-gray-600 mb-1">End Time</label>
                <input
                  type="time"
                  value={quickApplyEndTime}
                  onChange={(e) => setQuickApplyEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={applyToAllWorkDays}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                <Clock size={16} />
                Apply to All Work Days
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-28">Day</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600 w-36">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Start Time</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">End Time</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Rest Day</th>
                </tr>
              </thead>
              <tbody>
                {schedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(schedule => (
                  <tr key={schedule.dayOfWeek} className="border-b border-gray-100">
                    <td className="py-3 px-2 font-medium">{getDayName(schedule.dayOfWeek)}</td>
                    <td className="py-3 px-2 text-gray-500 text-xs">
                      {getDateForDay(schedule.dayOfWeek, scheduleEffectiveDate)}
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="time"
                        value={schedule.startTime}
                        onChange={(e) => updateSchedule(schedule.dayOfWeek, 'startTime', e.target.value)}
                        disabled={schedule.isRestDay}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="time"
                        value={schedule.endTime}
                        onChange={(e) => updateSchedule(schedule.dayOfWeek, 'endTime', e.target.value)}
                        disabled={schedule.isRestDay}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={schedule.isRestDay}
                          onChange={(e) => updateSchedule(schedule.dayOfWeek, 'isRestDay', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleSaveSchedule}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* Payroll Tab (Admin Only) */}
      {activeTab === 'payroll' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Payroll Management</h2>
                <p className="text-sm text-gray-500">Manage cutoff periods and view payroll summaries</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCutoffModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-gray-900 font-medium rounded-lg hover:bg-yellow-500"
                >
                  <Plus size={18} />
                  Create Cutoff
                </button>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Cutoff Period</label>
              <div className="flex gap-2 items-start">
                <select
                  value={selectedCutoff}
                  onChange={(e) => {
                    setSelectedCutoff(e.target.value);
                    loadPayrollSummary(e.target.value);
                  }}
                  className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a cutoff period</option>
                  {cutoffs.map(cutoff => (
                    <option key={cutoff.id} value={cutoff.id}>
                      {cutoff.name} ({cutoff.startDate} to {cutoff.endDate})
                    </option>
                  ))}
                </select>
                {selectedCutoff && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const cutoff = cutoffs.find(c => c.id === selectedCutoff);
                        if (cutoff) handleEditCutoff(cutoff);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Cutoff"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteCutoff(selectedCutoff)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Cutoff"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {selectedCutoff && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 font-medium text-gray-600">Employee</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-600">Total Hours</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-600">Hourly Rate</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-600">Gross Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollSummaries.map(summary => (
                        <tr key={summary.id} className="border-b border-gray-100">
                          <td className="py-3 px-2 font-medium">{summary.userName}</td>
                          <td className="py-3 px-2">{summary.totalHours.toFixed(2)} hrs</td>
                          <td className="py-3 px-2">₱{summary.hourlyRate.toFixed(2)}</td>
                          <td className="py-3 px-2 font-medium text-green-600">₱{summary.grossPay.toFixed(2)}</td>
                        </tr>
                      ))}
                      {payrollSummaries.length > 0 && (
                        <tr className="border-t-2 border-gray-300 bg-gray-50">
                          <td className="py-3 px-2 font-bold">TOTAL</td>
                          <td className="py-3 px-2 font-bold">
                            {payrollSummaries.reduce((sum, s) => sum + s.totalHours, 0).toFixed(2)} hrs
                          </td>
                          <td className="py-3 px-2">-</td>
                          <td className="py-3 px-2 font-bold text-green-600">
                            ₱{payrollSummaries.reduce((sum, s) => sum + s.grossPay, 0).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {payrollSummaries.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-400">
                            No payroll data for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Export Buttons - Always visible when cutoff is selected */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Export Options</h3>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={exportPayrollToCSV}
                      disabled={payrollSummaries.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Download size={18} />
                      Export Summary (CSV)
                    </button>
                    <button
                      onClick={exportDetailedPayrollToCSV}
                      disabled={payrollSummaries.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet size={18} />
                      Export Detailed (CSV)
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {payrollSummaries.length === 0 
                      ? 'No payroll data available for export. Approve time entries to generate payroll data.'
                      : 'Summary export includes totals per employee. Detailed export includes all individual time entries.'
                    }
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Cutoff Modal */}
      {showCutoffModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCutoff ? 'Edit Cutoff Period' : 'Create Cutoff Period'}
              </h3>
              <button 
                onClick={() => {
                  setShowCutoffModal(false);
                  setEditingCutoff(null);
                  setNewCutoff({ name: '', startDate: '', endDate: '' });
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period Name</label>
                <input
                  type="text"
                  value={newCutoff.name}
                  onChange={(e) => setNewCutoff({ ...newCutoff, name: e.target.value })}
                  placeholder="e.g., January 1-15, 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newCutoff.startDate}
                  onChange={(e) => setNewCutoff({ ...newCutoff, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={newCutoff.endDate}
                  onChange={(e) => setNewCutoff({ ...newCutoff, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setShowCutoffModal(false);
                  setEditingCutoff(null);
                  setNewCutoff({ name: '', startDate: '', endDate: '' });
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCutoff}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : (editingCutoff ? 'Update Cutoff' : 'Create Cutoff')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Status Badge Component
const StatusBadge: React.FC<{ status: 'pending' | 'approved' | 'rejected' }> = ({ status }) => {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  };
  
  const icons = {
    pending: <AlertCircle size={12} />,
    approved: <CheckCircle size={12} />,
    rejected: <X size={12} />
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};
