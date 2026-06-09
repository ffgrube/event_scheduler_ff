/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Task, Department, ProjectSettings, TaskStatus } from '../types';
import { 
  formatDateShort, 
  generateDateRange, 
  getTimeSlot, 
  DEFAULT_DEPARTMENTS,
  hexToRgb
} from '../utils';
import { 
  Trash2, 
  Edit3, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Plus, 
  Layers, 
  Filter, 
  ExternalLink,
  Printer,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  Download,
  Eye,
  Settings,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const PDF_SAFE_COLORS: Record<string, string> = {
  ALL: '#64748B',  // Slate
  ARC: '#0ea5e9',  // Sky Blue
  MISC: '#64748b', // Slate Gray
  LX: '#EAB308',   // Amber
  AV: '#3B82F6',   // Blue
  LOG: '#22C55E',  // Green
  STG: '#A855F7',  // Purple
  OPS: '#EF4444',  // Red
  MKT: '#EC4899',  // Pink
  SND: '#0891B2',  // Cyan/Sound
  GEN: '#4B5563',  // Slate Gray/General
};

interface UnifiedTimelineProps {
  tasks: Task[];
  settings: ProjectSettings;
  departments: Department[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (task: Task, shouldSort?: boolean) => void;
  onQuickAddAtSlot: (date: string, timeSlot: 'Early' | 'Mid' | 'Evening') => void;
  selectedDeptFilter: string;
  showToast: (msg: string, type?: 'success' | 'info') => void;
  isReadOnly?: boolean;
  onUpdateSettings?: (settings: ProjectSettings) => void;
}

export default function UnifiedTimeline({
  tasks,
  settings,
  departments,
  onEditTask,
  onDeleteTask,
  onUpdateTask,
  onQuickAddAtSlot,
  selectedDeptFilter,
  showToast,
  isReadOnly = false,
  onUpdateSettings,
}: UnifiedTimelineProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [colWidth, setColWidth] = useState<number>(105);

  // States related to PDF export & filters, moved to top to prevent Temporal Dead Zone ReferenceError during filteredTasks calculation
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'grid-a0' | 'grid-a3' | 'grid-a4' | 'agenda' | 'csv'>('agenda');
  const [highContrastGrid, setHighContrastGrid] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [exportDeptFilters, setExportDeptFilters] = useState<string[]>(['ALL']);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState<boolean>(false);
  const [includeNotesInExport, setIncludeNotesInExport] = useState<boolean>(true);
  const [exportOnlyWithNotes, setExportOnlyWithNotes] = useState<boolean>(false);
  const [viewingNotesTask, setViewingNotesTask] = useState<Task | null>(null);

  // Generate the timeline dates list based on setup settings
  const dateRange = generateDateRange(settings.startDate, settings.endDate);

  // Filter tasks based on active selection filter or export modal filters during PDF generation
  const filteredTasks = tasks.filter(task => {
    if (isGeneratingPDF) {
      if (!exportDeptFilters.includes('ALL') && exportDeptFilters.length > 0) {
        if (!exportDeptFilters.includes(task.code)) return false;
      }
      if (exportOnlyWithNotes) {
        const hasNotes = !!task.notes || task.subtasks?.some(sub => !!sub.notes);
        if (!hasNotes) return false;
      }
      return true;
    }

    const selectedDepts = selectedDeptFilter.split(',');
    if (selectedDepts.includes('ALL')) return true;
    return selectedDepts.includes(task.code);
  });

  // Structural subtasks rendering contract
  interface RowItem {
    type: 'parent' | 'subtask';
    task: Task;
    depth: number;
    itemNumberLabel: string;
    originalId: string;
  }

  const flattenTasks = (tasksList: Task[]): RowItem[] => {
    const result: RowItem[] = [];
    const recurse = (
      item: any,
      depth: number,
      parentTask: Task | undefined,
      itemNumberLabel: string
    ) => {
      if (depth === 0) {
        const taskVal = item as Task;
        result.push({
          type: 'parent',
          task: taskVal,
          depth: 0,
          itemNumberLabel,
          originalId: taskVal.id
        });
        if (taskVal.subtasks && taskVal.subtasks.length > 0) {
          taskVal.subtasks.forEach((sub, sIdx) => {
            recurse(sub, depth + 1, taskVal, `${itemNumberLabel}.${sIdx + 1}`);
          });
        }
      } else {
        const subtaskVal = item;
        const virtualTask: Task = {
          id: subtaskVal.id,
          code: parentTask?.code || 'GEN',
          date: parentTask?.date || '',
          time: subtaskVal.time || '',
          details: subtaskVal.details || '',
          status: subtaskVal.status || 'Not Started',
          durationDays: subtaskVal.durationDays || 1,
          subtasks: subtaskVal.subtasks
        };

        result.push({
          type: 'subtask',
          task: virtualTask,
          depth,
          itemNumberLabel,
          originalId: subtaskVal.id
        });

        if (subtaskVal.subtasks && subtaskVal.subtasks.length > 0) {
          subtaskVal.subtasks.forEach((nestedSub, nsIdx) => {
            recurse(nestedSub, depth + 1, parentTask, `${itemNumberLabel}.${nsIdx + 1}`);
          });
        }
      }
    };

    tasksList.forEach((task, idx) => {
      recurse(task, 0, undefined, `${idx + 1}`);
    });

    return result;
  };

  const flattenedRows = flattenTasks(filteredTasks);

  const handleToggleExportDept = (deptCode: string) => {
    if (deptCode === 'ALL') {
      setExportDeptFilters(['ALL']);
    } else {
      const withoutAll = exportDeptFilters.filter(item => item !== 'ALL');
      if (withoutAll.includes(deptCode)) {
        const next = withoutAll.filter(item => item !== deptCode);
        if (next.length === 0) {
          setExportDeptFilters(['ALL']);
        } else {
          setExportDeptFilters(next);
        }
      } else {
        setExportDeptFilters([...withoutAll, deptCode]);
      }
    }
  };

  const getExportDeptDisplayText = () => {
    if (exportDeptFilters.includes('ALL') || exportDeptFilters.length === 0) {
      return '-- ALL DEPARTMENTS --';
    }
    if (exportDeptFilters.length === departments.length) {
      return '-- ALL DEPARTMENTS --';
    }
    return departments
      .filter(d => exportDeptFilters.includes(d.code))
      .map(d => d.code)
      .join(', ');
  };

  const showReadOnlyLayout = isReadOnly || isGeneratingPDF;

  const getDeptColor = (code: string) => {
    const dept = departments.find(d => d.code.toUpperCase() === code.toUpperCase());
    return dept ? dept.color : (PDF_SAFE_COLORS[code] || '#64748B');
  };

  const getDependencyTask = (id?: string | null): Task | null => {
    if (!id) return null;
    const find = (list: any[]): any | null => {
      for (const t of list) {
        if (t.id === id) return t;
        if (t.subtasks && t.subtasks.length > 0) {
          const found = find(t.subtasks);
          if (found) return found;
        }
      }
      return null;
    };
    return find(tasks);
  };

  const generateBulkUploadCSV = () => {
    try {
      setIsExporting(true);
      showToast('Compiling Gemini CSV upload template...', 'info');

      // Flatten hierarchical tasks
      const flat: Task[] = [];
      const recurse = (item: any, parentCode?: string, parentDate?: string) => {
        const virtual: Task = {
          id: item.id,
          code: item.code || parentCode || 'MISC',
          date: item.date || parentDate || '',
          time: item.time || '',
          details: item.details || '',
          status: item.status || 'Not Started',
          durationDays: item.durationDays || 1,
          dependencyTaskId: item.dependencyTaskId || undefined,
          notes: item.notes || undefined,
          startTime: item.startTime || undefined,
          endTime: item.endTime || undefined
        };
        flat.push(virtual);
        if (item.subtasks && item.subtasks.length > 0) {
          item.subtasks.forEach((sub: any) => recurse(sub, virtual.code, virtual.date));
        }
      };
      tasks.forEach(t => recurse(t));

      // Filter tasks based on selected department filters in modal active state
      let targetTasks = flat;
      if (!exportDeptFilters.includes('ALL') && exportDeptFilters.length > 0) {
        targetTasks = targetTasks.filter(t => exportDeptFilters.includes(t.code));
      }
      if (exportOnlyWithNotes) {
        targetTasks = targetTasks.filter(t => t.notes);
      }

      // Group tasks by their details and time
      const groups: { [key: string]: Task[] } = {};
      for (const task of targetTasks) {
        const detailsKey = task.details.trim().toLowerCase();
        const timeKey = (task.time || '').trim().toLowerCase();
        const key = `${detailsKey}|${timeKey}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(task);
      }

      const rowEntries: {
        startDate: string;
        time: string;
        details: string;
        durationDays: number;
      }[] = [];

      // Helper to generate spanned date strings for a single task
      const getTaskDates = (task: Task): string[] => {
        const dates: string[] = [];
        if (!task.date) return [];
        const start = new Date(task.date + 'T00:00:00');
        const dur = task.durationDays || 1;
        for (let i = 0; i < dur; i++) {
          const nextDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
          const yyyy = nextDate.getFullYear();
          const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
          const dd = String(nextDate.getDate()).padStart(2, '0');
          dates.push(`${yyyy}-${mm}-${dd}`);
        }
        return dates;
      };

      // Helper to check if two YYYY-MM-DD date strings are consecutive calendar dates
      const isConsecutiveDay = (day1Str: string, day2Str: string): boolean => {
        const d1 = new Date(day1Str + 'T00:00:00');
        const d2 = new Date(day2Str + 'T00:00:00');
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 1;
      };

      // Collapse and find consecutive blocks in each group
      for (const key in groups) {
        const groupTasks = groups[key];
        
        // Gather unique active dates spanned by all tasks in this group
        const activeDatesSet = new Set<string>();
        for (const task of groupTasks) {
          const dates = getTaskDates(task);
          dates.forEach(d => activeDatesSet.add(d));
        }

        // Sort dates chronologically
        const sortedDates = Array.from(activeDatesSet).sort();

        if (sortedDates.length === 0) continue;

        // Find standard consecutive blocks
        const blocks: string[][] = [];
        let currentBlock: string[] = [sortedDates[0]];

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = currentBlock[currentBlock.length - 1];
          const currDate = sortedDates[i];
          if (isConsecutiveDay(prevDate, currDate)) {
            currentBlock.push(currDate);
          } else {
            blocks.push(currentBlock);
            currentBlock = [currDate];
          }
        }
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
        }

        // Map blocks to row entities
        for (const block of blocks) {
          const startDate = block[0];
          const durationDays = block.length;
          
          const originalTask = groupTasks.find(t => t.date === startDate) || groupTasks[0];
          
          rowEntries.push({
            startDate,
            time: originalTask.time || '',
            details: originalTask.details,
            durationDays
          });
        }
      }

      // Sort entries chronologically for export
      rowEntries.sort((a, b) => {
        const dateCompare = a.startDate.localeCompare(b.startDate);
        if (dateCompare !== 0) return dateCompare;
        return a.details.localeCompare(b.details);
      });

      // Build CSV String Compilation Phase
      const header = "NUS,START_DATE,TIME,Task Details Description,DURATION_DAYS";
      const csvRows = [header];

      for (const entry of rowEntries) {
        let escapedDetails = entry.details;
        if (escapedDetails.includes(',') || escapedDetails.includes('"') || escapedDetails.includes('\n')) {
          escapedDetails = `"${escapedDetails.replace(/"/g, '""')}"`;
        }
        csvRows.push(`NUS,${entry.startDate},${entry.time},${escapedDetails},${entry.durationDays}`);
      }

      const csvContent = csvRows.join('\n');

      // Client-Side download handler
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const cleanProjectName = settings.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      link.href = url;
      link.setAttribute('download', `${cleanProjectName}_bulk_upload_nus.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Bulk upload CSV exported successfully!', 'success');
    } catch (csvErr) {
      console.error('CSV compiler error:', csvErr);
      showToast('Error crafting CSV file. Please inspect console logs.', 'info');
    } finally {
      setIsExporting(false);
      setIsExportModalOpen(false);
    }
  };

  const generateAgendaPDF = () => {
    setIsExporting(true);
    showToast('Compiling print-ready Crew Agenda list...', 'info');

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
      const marginX = 15;
      let cursorY = 20;

      const drawHeader = (pageNum: number) => {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text('OPERATIONAL CREW AGENDA', marginX, cursorY);
        cursorY += 6;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Project: ${settings.projectName.toUpperCase()} • Daily Schedule Brief`, marginX, cursorY);
        cursorY += 5;

        doc.setFontSize(9);
        doc.text(`Timeline Stretch: ${settings.startDate} to ${settings.endDate}`, marginX, cursorY);
        
        doc.text(`Page ${pageNum}`, pageWidth - marginX - 10, cursorY - 11);
        
        cursorY += 4;
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.5);
        doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 8;
      };

      const drawFooter = (pageNum: number) => {
        doc.setFont('Helvetica', 'oblique');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        const printDate = new Date().toLocaleString();
        doc.text(`Compiled via Event Master Scheduler • ${printDate}`, marginX, pageHeight - 10);
        doc.text(`Page ${pageNum}`, pageWidth - marginX - 12, pageHeight - 10);
      };

      let pageNum = 1;
      drawHeader(pageNum);

      // Group tasks by day
      dateRange.forEach((dayDate, index) => {
        // Filter tasks based on PDF export configuration
        const dayTasks = tasks.filter(t => {
          if (t.date !== dayDate) return false;
          // Filter by department if specific ones are selected
          if (!exportDeptFilters.includes('ALL') && exportDeptFilters.length > 0 && !exportDeptFilters.includes(t.code)) return false;
          // Filter out tasks without notes if exportOnlyWithNotes is enabled
          if (exportOnlyWithNotes && !t.notes) return false;
          return true;
        });

        if (dayTasks.length === 0) return; // Skip days with zero tasks

        if (cursorY > pageHeight - 35) {
          drawFooter(pageNum);
          doc.addPage();
          pageNum++;
          cursorY = 20;
          drawHeader(pageNum);
        }

        // Draw Day background block
        doc.setFillColor(241, 245, 249); // slate-100
        doc.roundedRect(marginX, cursorY, pageWidth - (marginX * 2), 8, 1.5, 1.5, 'F');
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85); // slate-700
        
        const formattedDate = new Date(dayDate).toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric' 
        });
        doc.text(`DAY ${index + 1} — ${formattedDate}`, marginX + 4, cursorY + 5.5);
        cursorY += 13;

        // Sort tasks of this day by Time Slot order
        const slotOrder = { 'Early': 1, 'Mid': 2, 'Evening': 3, 'All Day': 4 };
        const getSlotLabel = (t: Task) => {
          const time = t.time || 'All Day';
          if (time.toLowerCase().includes('early') || time === '08:00' || time === '10:00') return 'Early';
          if (time.toLowerCase().includes('mid') || time === '12:00' || time === '14:00' || time === '16:00') return 'Mid';
          if (time.toLowerCase().includes('evening') || time === '18:00' || time === '20:00') return 'Evening';
          return 'All Day';
        };

        const dayFlattened: { task: Task; prefix: string; depth: number }[] = [];
        const flatRecurse = (item: any, depth: number, parentCode: string) => {
          // Skip if we want only tasks with notes, and this subitem does not have notes
          if (exportOnlyWithNotes && !item.notes) {
            // But still recurse subtasks to check them
            if (item.subtasks && item.subtasks.length > 0) {
              item.subtasks.forEach((sub: any) => {
                flatRecurse(sub, depth + 1, parentCode);
              });
            }
            return;
          }

          if (depth === 0) {
            dayFlattened.push({ task: item, prefix: '', depth: 0 });
            if (item.subtasks && item.subtasks.length > 0) {
              item.subtasks.forEach((sub: any) => {
                flatRecurse(sub, depth + 1, item.code);
              });
            }
          } else {
            const virtual: Task = {
              id: item.id,
              code: parentCode,
              date: dayDate,
              time: item.time || '',
              details: item.details || '',
              status: item.status || 'Not Started',
              durationDays: item.durationDays || 1,
              subtasks: item.subtasks,
              notes: item.notes,
              startTime: item.startTime,
              endTime: item.endTime,
              dependencyTaskId: item.dependencyTaskId
            };
            dayFlattened.push({ task: virtual, prefix: '   ', depth });
            if (item.subtasks && item.subtasks.length > 0) {
              item.subtasks.forEach((nestedSub: any) => {
                flatRecurse(nestedSub, depth + 1, parentCode);
              });
            }
          }
        };

        dayTasks.forEach((task) => {
          flatRecurse(task, 0, task.code);
        });

        dayFlattened.forEach(({ task, depth }) => {
          if (cursorY > pageHeight - 30) {
            drawFooter(pageNum);
            doc.addPage();
            pageNum++;
            cursorY = 20;
            drawHeader(pageNum);
          }

          const activeSlot = getSlotLabel(task);
          const deptColorHex = getDeptColor(task.code);

          // Robust hex conversion to RGB safeguarding older PDF export builds
          const { r, g, b } = hexToRgb(deptColorHex);

          // Draw small color marker
          doc.setFillColor(r, g, b);
          doc.circle(marginX + 3 + (depth * 4), cursorY + 2.5, 1.5, 'F');

          // Tag
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(r, g, b);
          doc.text(`[${task.code}]`, marginX + 8 + (depth * 4), cursorY + 3.5);

          // Slot Label
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text(`${activeSlot} (${task.time || 'All Day'}):`, marginX + 24 + (depth * 4), cursorY + 3.5);

          // Details text wrap helper
          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(51, 65, 85); // slate-700
          
          const descX = marginX + 54 + (depth * 4);
          const maxDescWidth = pageWidth - marginX - descX;
          const splitDetails = doc.splitTextToSize(task.details || 'No task description available.', maxDescWidth);
          
          doc.text(splitDetails, descX, cursorY + 3.5);
          
          const lineHeightMultiplier = splitDetails.length;
          cursorY += 5 + (lineHeightMultiplier * 3.5);

          // Print detailed times if any of them are provided
          if (task.startTime || task.endTime) {
            if (cursorY > pageHeight - 15) {
              drawFooter(pageNum);
              doc.addPage();
              pageNum++;
              cursorY = 20;
              drawHeader(pageNum);
            }
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(99, 102, 241); // slate/indigo
            let timeSegments = [];
            if (task.startTime) timeSegments.push(`▶ Start: ${task.startTime}`);
            if (task.endTime) timeSegments.push(`⏹ End: ${task.endTime}`);
            doc.text(timeSegments.join('   '), descX, cursorY + 2.5);
            cursorY += 4.5;
          }

          // Print detailed specifications / notes
          if (includeNotesInExport && task.notes) {
            const notesText = `Notes: ${task.notes}`;
            const splitNotes = doc.splitTextToSize(notesText, maxDescWidth - 4);

            if (cursorY + (splitNotes.length * 3.5) > pageHeight - 15) {
              drawFooter(pageNum);
              doc.addPage();
              pageNum++;
              cursorY = 20;
              drawHeader(pageNum);
            }

            doc.setFont('Helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // slate-500

            // Draw micro notes border bar on left side of paragraph
            doc.setDrawColor(203, 213, 225); // slate-300
            doc.setLineWidth(0.3);
            doc.line(descX - 2, cursorY + 1, descX - 2, cursorY + (splitNotes.length * 3.5));

            doc.text(splitNotes, descX, cursorY + 3);
            cursorY += 4 + (splitNotes.length * 3.5);
          }

          // Gap between distinct items
          cursorY += 2;
        });

        cursorY += 3;
      });

      drawFooter(pageNum);
      
      const cleanProjectName = settings.projectName.toLowerCase().replace(/[^a-zA-Z0-9_\-]+/g, '_');
      doc.save(`${cleanProjectName}_crew_agenda.pdf`);
      showToast('Standard Portrait A4 Agenda PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF Agenda generating warning:', err);
      showToast('Error crafting operational Agenda document.', 'info');
    } finally {
      setIsExporting(false);
      setIsExportModalOpen(false);
    }
  };

  const handleExportGridToPDF = async (format: 'grid-a0' | 'grid-a3' | 'grid-a4') => {
    const container = document.getElementById('unified-timeline-panel');
    if (!container) return;

    setIsExporting(true);
    setIsGeneratingPDF(true); // Redraw timeline layout into safe high-fidelity print state
    const sizeLabels = {
      'grid-a0': 'A0 Landscape (Poster Size / Blueprint)',
      'grid-a3': 'A3 Landscape (Standard Event Binder)',
      'grid-a4': 'A4 Landscape (Compact Ledger Size)'
    };
    showToast(`Preparing ${sizeLabels[format]} grid layout...`, 'info');

    // 1. Back up the original window.getComputedStyle style reader
    const originalGetComputedStyle = window.getComputedStyle;

    // 2. Intercept styles right before html2canvas runs to neutralize oklab / oklch functions
    window.getComputedStyle = function(el, pseudoElt) {
      const style = originalGetComputedStyle(el, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          const value = target[prop as any];
          if (typeof value === 'function') {
            return (value as any).bind(target);
          }
          if (typeof value === 'string' && (value.includes('oklab') || value.includes('oklch'))) {
            return 'rgb(248, 250, 252)'; // Fallback immediately to a safe plain light gray/slate color
          }
          return value;
        }
      });
    };

    let clonedElement: HTMLElement | null = null;

    try {
      // Temporarily mark real container elements as printing to apply necessary override classes
      if (highContrastGrid) {
        container.classList.add('high-contrast-grid');
      }
      container.classList.add('is-printing-pdf');

      // Brief delay for React to finish rendering inputs/selects in read-only form
      await new Promise((resolve) => setTimeout(resolve, 380));

      // 2. Temporary DOM Clone For Infinite Width Snapshotting
      clonedElement = container.cloneNode(true) as HTMLElement;
      clonedElement.id = 'unified-timeline-panel-pdf-clone';

      // Ensure the clone is visible for layout engine calculations but pushed entirely offscreen
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-99999px';
      clonedElement.style.top = '-99999px';
      clonedElement.style.visibility = 'visible';
      clonedElement.style.maxWidth = 'none';
      clonedElement.style.height = 'auto';

      // Remove browser width caps and scrolling zones on clone
      const clonedTableContainer = clonedElement.querySelector('#scheduler-table-container') as HTMLElement;
      if (clonedTableContainer) {
        clonedTableContainer.style.overflowX = 'visible';
        clonedTableContainer.style.overflow = 'visible';
        clonedTableContainer.style.width = 'auto';
        clonedTableContainer.style.maxWidth = 'none';
      }

      // Append clone to DOM to read and inflate dimensions
      document.body.appendChild(clonedElement);

      const realTableContainer = document.getElementById('scheduler-table-container');
      const measuredScrollWidth = realTableContainer ? realTableContainer.scrollWidth : 2400;

      // Force clone wrapper width to hold the total table scrollable size plus margin buffer
      const targetWidth = measuredScrollWidth + 80;
      clonedElement.style.width = `${targetWidth}px`;
      clonedElement.style.maxHeight = 'none';
      clonedElement.style.overflow = 'visible';
      
      if (clonedTableContainer) {
        clonedTableContainer.style.width = `${measuredScrollWidth}px`;
        clonedTableContainer.style.maxHeight = 'none';
        clonedTableContainer.style.height = 'auto';
      }

      // Brief delay to permit document element recalculation
      await new Promise((resolve) => setTimeout(resolve, 400));

      const captureScale = format === 'grid-a0' ? 2 : format === 'grid-a3' ? 1.5 : 1.2;

      // 3. Complete Width Canvas Metrics utilizing element's full scrollable dimensions
      const canvas = await html2canvas(clonedElement, {
        width: clonedElement.scrollWidth,
        height: clonedElement.scrollHeight,
        windowWidth: clonedElement.scrollWidth, // Forces html2canvas to render at ultra-wide resolution desktop scale
        scale: captureScale, // Keeps text definitions exceptionally sharp
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // 4. Proportional PDF Canvas Slicing with Dynamic Page Offsets Support Multi-page A0 Landscape slicing
      let pageWidthMm = 1189;
      let pageHeightMm = 841;
      let pdfFormat: string = 'a0';

      if (format === 'grid-a3') {
        pageWidthMm = 420;
        pageHeightMm = 297;
        pdfFormat = 'a3';
      } else if (format === 'grid-a4') {
        pageWidthMm = 297;
        pageHeightMm = 210;
        pdfFormat = 'a4';
      }

      // Map scale from pixel width to mm width
      const ratio = pageWidthMm / canvas.width;
      const totalHeightMm = canvas.height * ratio;

      // Extract all row elements in tbody to avoid breaking inside them
      const rows = Array.from(clonedElement.querySelectorAll('tbody tr')) as HTMLElement[];
      const rowRangesMm = rows.map(rEle => {
        const rect = rEle.getBoundingClientRect();
        const parentRect = clonedElement!.getBoundingClientRect();
        const topPx = rect.top - parentRect.top;
        const heightPx = rect.height;
        return {
          topMm: topPx * ratio,
          bottomMm: (topPx + heightPx) * ratio
        };
      });

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: pdfFormat
      });

      let currentYMm = 0;
      let pageIndex = 0;

      while (currentYMm < totalHeightMm) {
        if (pageIndex > 0) {
          doc.addPage(pdfFormat, 'l');
        }

        let nextSliceYMm = currentYMm + pageHeightMm;
        
        // If there's more content left that doesn't fit in standard pageHeightMm
        if (nextSliceYMm < totalHeightMm) {
          // Find any row that spans across the boundary nextSliceYMm
          const crossingRow = rowRangesMm.find(r => r.topMm < nextSliceYMm && r.bottomMm > nextSliceYMm);
          
          if (crossingRow && crossingRow.topMm > currentYMm) {
            // Settle slice boundary right at the top of the crossing row (break-inside-avoid)
            nextSliceYMm = crossingRow.topMm;
          }
        }

        const sliceHeightMm = Math.min(nextSliceYMm - currentYMm, totalHeightMm - currentYMm);
        
        // Convert mm coordinates back to pixel coordinates on the source canvas
        const sourceYPx = currentYMm / ratio;
        const sourceHPx = sliceHeightMm / ratio;

        // Create a temporary canvas for this sliced page
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sourceHPx;

        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          // Fill pure white background
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          
          // Draw the sliced viewport portion
          sliceCtx.drawImage(
            canvas,
            0, sourceYPx, canvas.width, sourceHPx, // source bounds
            0, 0, sliceCanvas.width, sliceCanvas.height // target bounds
          );
        }

        const imgData = sliceCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, pageWidthMm, sliceHeightMm);

        currentYMm = nextSliceYMm;
        pageIndex++;
      }
      
      const cleanProjectName = settings.projectName.toLowerCase().replace(/[^a-zA-Z0-9_\-]+/g, '_');
      const formatSuffix = format.replace('grid-', '');
      doc.save(`${cleanProjectName}_gantt_blueprint_${formatSuffix}.pdf`);

      showToast(`Landscape Gantt chart PDF generated successfully (${formatSuffix.toUpperCase()})!`, 'success');
    } catch (err) {
      console.error('PDF Grid export error:', err);
      showToast('Error crafting PDF file. Please inspect console logs.', 'info');
    } finally {
      // Clean up DOM clone
      if (clonedElement && document.body.contains(clonedElement)) {
        document.body.removeChild(clonedElement);
      }

      // Restore style classes on original container element
      if (highContrastGrid) {
        container.classList.remove('high-contrast-grid');
      }
      container.classList.remove('is-printing-pdf');

      // 3. Completely restore the original browser style reader immediately after rendering
      window.getComputedStyle = originalGetComputedStyle;
      
      setIsExporting(false);
      setIsGeneratingPDF(false); // Restore fully editable interactive controls
      setIsExportModalOpen(false);
    }
  };

  const handleExportToPDF = async () => {
    if (exportFormat === 'csv') {
      generateBulkUploadCSV();
    } else if (exportFormat === 'agenda') {
      generateAgendaPDF();
    } else {
      handleExportGridToPDF(exportFormat);
    }
  };

  return (
    <div id="unified-timeline-panel" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* PDF PRINT ONLY HEADER WITH BLUEPRINT AESTHETICS */}
      <div className="print-header-pdf hidden px-8 py-6 border-b-2 border-slate-900 bg-slate-50/80">
        <div className="flex justify-between items-end">
          <div>
            <span className="text-xs font-black tracking-widest text-indigo-600 uppercase">OFFICIAL PRODUCTION GANTT BLUEPRINT</span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">{settings.projectName}</h1>
            <p className="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-1.5 font-mono">
              Timeline Span: {settings.startDate} to {settings.endDate} ({dateRange.length} Days)
            </p>
          </div>
          <div className="text-right">
            <span className="text-base font-extrabold text-slate-800 uppercase tracking-tight font-sans">PRODUCTION OFFICE</span>
            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase font-mono">GANTT MAP • LANDSCAPE VIEW</div>
          </div>
        </div>
      </div>

      {/* Top Section */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/70 no-print">
        <div>
          <h2 id="scheduler-title" className="text-base font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            {settings.projectName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Timeline Span: <span className="text-slate-700 font-semibold">{settings.startDate}</span> to <span className="text-slate-700 font-semibold">{settings.endDate}</span> ({dateRange.length} Days)
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-start md:self-center">
          {/* PDF EXPORT BUTTON */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 border rounded-lg bg-indigo-600 hover:bg-indigo-700 border-indigo-650 text-white shadow-2xs select-none hover:shadow active:scale-97 cursor-pointer no-print focus:outline-none"
            title="Configure and download custom styled PDF printouts of the schedule"
          >
            <Printer className="w-4 h-4 text-indigo-100" />
            Export PDF Options
          </button>

          {/* TIME ZOOM CONTROLLER SLIDER */}
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-2xs select-none no-print">
            <ZoomIn className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-slate-500 font-semibold text-[11px]">Time Span:</span>
            <input
              type="range"
              min="55"
              max="240"
              value={colWidth}
              onChange={(e) => setColWidth(Number(e.target.value))}
              className="w-20 accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
              title="Drag slider to zoom grid columns in/out"
            />
            <span className="font-mono text-[10px] text-indigo-600 w-8 text-right font-black">{colWidth}px</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-medium shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Task Count: <strong className="text-slate-800">{filteredTasks.length}</strong> sorted</span>
          </div>
        </div>
      </div>

      {/* Synchronized Table Layout */}
      <div id="scheduler-table-container" className="w-full max-h-[640px] overflow-auto border border-slate-200/40 rounded-xl relative">
        <table className="w-full border-collapse text-left min-w-[1100px]">
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff', borderBottom: '1px solid #334155' }}>
              {/* Left Side Static Headers with perfect width definitions */}
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155', top: 0 }}
                className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider border-r w-12 min-w-[48px] max-w-[48px] sticky top-0 left-0 z-40"
              >
                Item
              </th>
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155', top: 0 }}
                className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider border-r w-16 min-w-[64px] max-w-[64px] sticky top-0 left-12 z-40"
              >
                CODE
              </th>
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155', top: 0 }}
                className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider border-r w-32 min-w-[128px] max-w-[128px] sticky top-0 left-28 z-40"
              >
                Date
              </th>
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155', top: 0 }}
                className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider border-r w-[460px] min-w-[460px] sticky top-0 left-60 z-40"
              >
                Task Details (Direct inline editing)
              </th>
 
              {/* Right Side Date Slots Headers */}
              {dateRange.map((dayDate, dayIdx) => {
                const dayName = settings.dayNames?.[dayDate] || '';
                const dayNote = settings.dayNotes?.[dayDate] || '';

                return (
                  <th 
                    key={dayDate} 
                    style={{ 
                      backgroundColor: '#0f172a', 
                      color: '#ffffff', 
                      borderColor: '#334155',
                      minWidth: `${colWidth}px`,
                      maxWidth: `${colWidth}px`,
                      width: `${colWidth}px`,
                      top: 0
                    }}
                    className="text-center text-[10px] font-extrabold uppercase border-r py-2 px-1.5 tracking-wide align-top sticky top-0 z-30"
                  >
                    <div style={{ color: '#a5b4fc' }} className="text-[10px] font-bold">DAY {dayIdx + 1}</div>
                    <div className="text-[11px] font-extrabold text-white mt-0.5">{formatDateShort(dayDate)}</div>
                    
                    {/* CUSTOM DAY NAME & NOTE FIELDS */}
                    {showReadOnlyLayout ? (
                      <div className="mt-2 space-y-1 normal-case text-left font-sans select-all font-normal">
                        {dayName && (
                          <div 
                            style={{ maxWidth: `${colWidth - 8}px` }}
                            className="text-[10px] font-bold text-indigo-300 truncate text-center mx-auto block" 
                            title={dayName}
                          >
                            ● {dayName}
                          </div>
                        )}
                        {dayNote && (
                          <div 
                            style={{ maxWidth: `${colWidth - 8}px` }}
                            className="text-[9px] text-slate-400 italic break-words leading-tight text-center mx-auto block" 
                            title={dayNote}
                          >
                            {dayNote}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2.5 flex flex-col gap-1.5 normal-case font-sans">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Day Name"
                            value={dayName}
                            onChange={(e) => {
                              const updatedNames = {
                                ...(settings.dayNames || {}),
                                [dayDate]: e.target.value
                              };
                              if (onUpdateSettings) {
                                onUpdateSettings({
                                  ...settings,
                                  dayNames: updatedNames
                                });
                              }
                            }}
                            style={{ maxWidth: `${colWidth - 8}px` }}
                            className="w-full text-[9.5px] font-semibold bg-[#1e293b] border border-slate-700 hover:border-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 text-white rounded px-1.5 py-1 text-center placeholder-slate-500 focus:outline-none transition-all truncate mx-auto block"
                            title="Name this Day (e.g. Press Day, Show Start)"
                          />
                        </div>
                        <div className="relative">
                          <textarea
                            placeholder="Potential notes"
                            rows={2}
                            value={dayNote}
                            onChange={(e) => {
                              const updatedNotes = {
                                ...(settings.dayNotes || {}),
                                [dayDate]: e.target.value
                              };
                              if (onUpdateSettings) {
                                onUpdateSettings({
                                  ...settings,
                                  dayNotes: updatedNotes
                                });
                              }
                            }}
                            style={{ maxWidth: `${colWidth - 8}px`, resize: 'none' }}
                            className="w-full text-[9px] bg-[#1e293b]/70 border border-slate-750 hover:border-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 text-slate-300 rounded px-1.5 py-1 text-center placeholder-slate-550 italic focus:outline-none transition-all font-medium leading-tight mx-auto block"
                            title="Notes for today (e.g. Gates open at 17:00)"
                          />
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {flattenedRows.length === 0 ? (
              <tr>
                <td colSpan={4 + dateRange.length} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No tasks found</p>
                    <p className="text-xs text-slate-500">
                      There are no scheduled tasks matching the current filters. Add a task or adjust filters to begin.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              flattenedRows.map((row, idx) => {
                const task = row.task;
                const isHovered = hoveredRowId === row.originalId;

                return (
                  <tr 
                    key={`row-${row.originalId}`}
                    onMouseEnter={() => setHoveredRowId(row.originalId)}
                    onMouseLeave={() => {
                      setHoveredRowId(null);
                      setConfirmingDeleteId(null);
                    }}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: isHovered ? '#f1f5f9' : '#ffffff',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }}
                    className="break-inside-avoid"
                  >
                    {/* 1. Item Label */}
                    <td 
                      style={{
                        backgroundColor: isHovered ? '#f1f5f9' : '#ffffff',
                        borderRight: '1px solid #e2e8f0'
                      }}
                      className="px-3 py-1.5 text-center text-[11px] font-mono font-bold text-slate-400 sticky left-0 z-20 w-12 min-w-[48px] max-w-[48px]"
                    >
                      {row.itemNumberLabel}
                    </td>

                    {/* 2. Department CODE dropdown */}
                    <td 
                      style={{
                        backgroundColor: isHovered ? '#f1f5f9' : '#ffffff',
                        borderRight: '1px solid #e2e8f0'
                      }}
                      className="px-2 py-1.5 text-center sticky left-12 z-20 w-16 min-w-[64px] max-w-[64px]"
                    >
                      {showReadOnlyLayout || row.type === 'subtask' ? (
                        <div
                          style={{ backgroundColor: getDeptColor(task.code) }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white text-center min-w-[48px] max-w-[56px] select-none mx-auto opacity-80"
                        >
                          {task.code}
                        </div>
                      ) : (
                        <select
                          value={task.code}
                          onChange={(e) => {
                            onUpdateTask({ ...task, code: e.target.value }, true);
                          }}
                          style={{ backgroundColor: getDeptColor(task.code) }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white text-center cursor-pointer outline-none border-none min-w-[48px] max-w-[56px] appearance-none hover:scale-105 active:scale-95 transition-transform"
                        >
                          {departments.map((dept) => (
                            <option key={dept.code} value={dept.code} className="bg-slate-800 text-white font-bold text-xs">
                              {dept.code}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* 3. Date picker input */}
                    <td 
                      style={{
                        backgroundColor: isHovered ? '#f1f5f9' : '#ffffff',
                        borderRight: '1px solid #e2e8f0'
                      }}
                      className="px-1 py-1 sticky left-28 z-20 w-32 min-w-[128px] max-w-[128px]"
                    >
                      {showReadOnlyLayout || row.type === 'subtask' ? (
                        <div className="w-full px-1 py-0.5 text-xs font-semibold text-slate-500 select-all font-mono">
                          {task.date}
                        </div>
                      ) : (
                        <input
                          type="date"
                          value={task.date}
                          onChange={(e) => {
                            onUpdateTask({ ...task, date: e.target.value }, false);
                          }}
                          onBlur={() => {
                            onUpdateTask(task, true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full bg-transparent px-1 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none border border-transparent transition-all"
                        />
                      )}
                    </td>

                    {/* 4. Task Details input with Direct Actions */}
                    <td 
                      style={{
                        backgroundColor: isHovered ? '#f1f5f9' : '#ffffff',
                        borderRight: '1px solid #e2e8f0'
                      }}
                      className="px-2 py-1 sticky left-60 z-20 w-[460px] min-w-[460px] max-w-[460px]"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        {/* Hierarchical list identation visual tree connectors */}
                        {row.depth > 0 && (
                          <span 
                            style={{ paddingLeft: `${(row.depth - 1) * 16}px` }}
                            className="text-indigo-400 font-black font-mono select-none"
                          >
                            └─
                          </span>
                        )}
                        <div className="flex-grow flex items-center justify-between gap-1.5 min-w-0">
                          {showReadOnlyLayout ? (
                            <div className="flex flex-col w-full">
                              <div className={`w-full px-1.5 py-1 font-semibold text-slate-700 select-all leading-tight break-words ${isGeneratingPDF ? 'text-[10px]' : 'text-xs'}`} title={task.details}>
                                {task.details}
                              </div>
                              {isGeneratingPDF && includeNotesInExport && task.notes && (
                                <div className="px-1.5 py-0.5 text-[9px] text-indigo-650 bg-indigo-50/40 rounded border border-indigo-100/30 italic mt-1 max-w-[440px] break-words leading-normal">
                                  📝 Notes: {task.notes}
                                </div>
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={task.details}
                              onChange={(e) => {
                                onUpdateTask({ ...task, details: e.target.value }, false);
                              }}
                              onBlur={() => {
                                onUpdateTask(task, true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-full bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none border border-transparent transition-all min-w-0"
                              title="Click directly to edit this task details"
                            />
                          )}

                          {/* Indicators block */}
                          <div className="flex items-center gap-1 flex-shrink-0 select-none">
                            {task.startTime && (
                              <span className="inline-flex items-center font-bold text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-100" title={`Start time: ${task.startTime}`}>
                                ▶ {task.startTime}
                              </span>
                            )}
                            {task.endTime && (
                              <span className="inline-flex items-center font-bold text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-100" title={`End time: ${task.endTime}`}>
                                ⏹ {task.endTime}
                              </span>
                            )}
                            {task.dependencyTaskId && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dep = getDependencyTask(task.dependencyTaskId);
                                  if (dep) setViewingNotesTask(dep);
                                }}
                                className="inline-flex items-center font-bold text-[9px] text-slate-700 bg-slate-50 hover:bg-slate-100 px-1 rounded border border-slate-205 cursor-pointer"
                                title={`Requires: ${getDependencyTask(task.dependencyTaskId)?.details || 'Prior Task'}`}
                              >
                                🔗 {getDependencyTask(task.dependencyTaskId)?.code || 'Req'}
                              </span>
                            )}
                            {task.notes && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingNotesTask(task);
                                }}
                                className="p-1 text-slate-450 hover:text-indigo-650 rounded cursor-pointer transition-colors"
                                title="Click to read detailed notes"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                              </button>
                            )}
                          </div>

                          {/* Direct action buttons (Always visible to ensure 100% reliability) */}
                          {!showReadOnlyLayout && (
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-lg px-1 py-0.5 flex-shrink-0 shadow-2xs no-print">
                              <button
                                onClick={() => {
                                  onEditTask(task);
                                }}
                                title="Open in pop-up editing window"
                                className="p-1 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Plus button to add subtasks recursively under any item */}
                              {(row.type === 'parent' || row.type === 'subtask') && (
                                <button
                                  onClick={() => {
                                    const nestedSubtaskDraft = {
                                      id: '',
                                      code: task.code,
                                      date: task.date,
                                      time: '',
                                      details: '',
                                      status: 'Not Started' as TaskStatus,
                                      durationDays: 1,
                                      parentTaskId: row.originalId,
                                    };
                                    onEditTask(nestedSubtaskDraft as any);
                                  }}
                                  title="Add a subtask indented under this item"
                                  className="p-1 hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 rounded transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              
                              {confirmingDeleteId === row.originalId ? (
                                <button
                                  onClick={() => {
                                    onDeleteTask(row.originalId);
                                    setConfirmingDeleteId(null);
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] rounded transition-all uppercase select-none duration-100 animate-pulse cursor-pointer"
                                  title="Click again to confirm deletion from schedule"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(row.originalId)}
                                  title="Delete task from schedule"
                                  className="p-1 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Right Side Timeline Plot Cells - SINGLE DAY SOLID COLUMNS */}
                    {(() => {
                      const cells: React.ReactNode[] = [];
                      let skipCount = 0;
                      
                      for (let dayIdx = 0; dayIdx < dateRange.length; dayIdx++) {
                        const dayDate = dateRange[dayIdx];
                        
                        if (skipCount > 0) {
                          skipCount--;
                          continue; // skip rendering because a previous multi-day block spans this column
                        }
                        
                        const isStartDay = task.date === dayDate;
                        
                        if (isStartDay) {
                          // Calculate active span
                          const duration = task.durationDays || 1;
                          const colSpan = Math.min(duration, dateRange.length - dayIdx);
                          skipCount = colSpan - 1;
                                    cells.push(
                            <td 
                              key={`cell-${row.originalId}-${dayDate}`}
                              colSpan={colSpan}
                              onClick={() => {
                                setViewingNotesTask(task);
                              }}
                              style={{
                                borderRight: '1px solid #e2e8f0',
                                backgroundColor: '#f0f4ff', // lightly highlighted active track line
                                padding: '4px',
                                minWidth: `${colWidth * colSpan}px`,
                                maxWidth: `${colWidth * colSpan}px`,
                                width: `${colWidth * colSpan}px`
                              }}
                              className="text-center align-middle transition-all relative cursor-pointer"
                            >
                              <div
                                style={{ backgroundColor: getDeptColor(task.code) }}
                                className="w-full min-h-[30px] rounded-lg text-white font-extrabold flex flex-col items-center justify-center shadow-xs px-2.5 py-1 transition-transform hover:scale-[1.01] active:scale-95 cursor-pointer"
                                title={`${task.code}: ${task.details} (${task.time || 'All Day'}) - Click to view detailed notes`}
                              >
                                <span className="text-[10px] tracking-widest uppercase font-black">{task.code}</span>
                                <span className="text-[9px] opacity-90 mt-0.5 font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                  {task.time || 'All Day'}
                                </span>
                                {(task.startTime || task.endTime) && (
                                  <div className="flex gap-1.5 mt-0.5 opacity-95 text-[8px] font-black items-center bg-black/10 px-1 py-0.5 rounded-sm">
                                    {task.startTime && <span title={`Start: ${task.startTime}`}>▶ {task.startTime}</span>}
                                    {task.endTime && <span title={`End: ${task.endTime}`}>⏹ {task.endTime}</span>}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        } else {
                          cells.push(
                            <td 
                              key={`cell-${row.originalId}-${dayDate}`}
                              onClick={() => {
                                if (showReadOnlyLayout) return;
                                // Clicking empty grid cell opens add form prefilled with date & department!
                                const draftTask = {
                                  id: '',
                                  code: (selectedDeptFilter !== 'ALL' && !selectedDeptFilter.includes(',')) ? selectedDeptFilter : task.code,
                                  date: dayDate,
                                  time: '',
                                  details: `New event task`,
                                  status: 'Not Started' as TaskStatus,
                                  durationDays: 1
                                };
                                onEditTask(draftTask as any);
                              }}
                              style={{
                                borderRight: '1px solid #e2e8f0',
                                backgroundColor: isHovered ? '#f8fafc' : '#ffffff',
                                minWidth: `${colWidth}px`,
                                maxWidth: `${colWidth}px`,
                                width: `${colWidth}px`
                              }}
                              className={`p-1.5 text-center transition-all relative h-[38px] ${
                                showReadOnlyLayout ? 'cursor-default' : 'cursor-cell group'
                              }`}
                            >
                              {!showReadOnlyLayout && isHovered && (
                                <span className="opacity-0 group-hover:opacity-100 text-xs text-indigo-300 font-extrabold inline-block transform hover:scale-125 transition-transform">+</span>
                              )}
                            </td>
                          );
                        }
                      }
                      
                      return cells;
                    })()}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Info Footnote */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 gap-2 no-print">
        <span className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          {isReadOnly 
            ? 'View-Only Mode Active: All operational values, dates, and details are static and non-editable.' 
            : 'Pro-tip: Click any cell in the grid to instantly add a new task, or edit the existing scheduled department task!'}
        </span>
        <span className="font-medium text-[11px] text-slate-400 font-mono text-right">
          Gantt Track Layout • High-Density SOLID Single-Day Briefing
        </span>
      </div>

      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
            {/* Backdrop click close */}
            <div className="absolute inset-0 cursor-default" onClick={() => !isExporting && setIsExportModalOpen(false)} />
            
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="relative w-full max-w-lg bg-white border border-slate-250 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-850 tracking-wider flex items-center gap-2 uppercase">
                    <Printer className="w-4 h-4 text-indigo-600" />
                    Reworked PDF Print Center
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Select operational formats and paper constraints</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  disabled={isExporting}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Select Layout Format</span>
                  
                  <div className="flex flex-col gap-2.5">
                    {/* OPTION 1: CHRONOLOGICAL AGENDA LIST */}
                    <label 
                      className={`flex items-start gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all select-none hover:bg-slate-50/50 ${
                        exportFormat === 'agenda' 
                          ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600/20' 
                          : 'border-slate-200'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="exportFormat" 
                        value="agenda" 
                        checked={exportFormat === 'agenda'}
                        onChange={() => setExportFormat('agenda')}
                        className="mt-1 accent-indigo-650 cursor-pointer text-indigo-600"
                        disabled={isExporting}
                      />
                      <div className="flex-grow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800">Operational Crew Agenda Checklist</span>
                          <span className="text-[9px] font-black uppercase py-0.5 px-2 rounded-full bg-indigo-100 text-indigo-700">A4 Portrait</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                          Generates an elegant portrait list of action items grouped chronologically by event days with beautiful colored department markers. Unbelievably readable on standard print sheets or phone displays.
                        </p>
                      </div>
                    </label>

                    {/* OPTION 2: LANDSCAPE A3 GRID MAP */}
                    <label 
                      className={`flex items-start gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all select-none hover:bg-slate-50/50 ${
                        exportFormat === 'grid-a3' 
                          ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600/20' 
                          : 'border-slate-200'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="exportFormat" 
                        value="grid-a3" 
                        checked={exportFormat === 'grid-a3'}
                        onChange={() => setExportFormat('grid-a3')}
                        className="mt-1 accent-indigo-650 cursor-pointer"
                        disabled={isExporting}
                      />
                      <div className="flex-grow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800">Landscape Grid Spreadsheet (A3 Style)</span>
                          <span className="text-[9px] font-black uppercase py-0.5 px-2 rounded-full bg-amber-100 text-amber-800">A3 Landscape</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                          Captures the complete physical scheduler table. Auto-scales column width properties beautifully to fit regular administrative and organizational briefs.
                        </p>
                      </div>
                    </label>

                    {/* OPTION 3: LANDSCAPE A4 GRID MAP */}
                    <label 
                      className={`flex items-start gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all select-none hover:bg-slate-50/50 ${
                        exportFormat === 'grid-a4' 
                          ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600/20' 
                          : 'border-slate-200'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="exportFormat" 
                        value="grid-a4" 
                        checked={exportFormat === 'grid-a4'}
                        onChange={() => setExportFormat('grid-a4')}
                        className="mt-1 accent-indigo-650 cursor-pointer"
                        disabled={isExporting}
                      />
                      <div className="flex-grow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800">Landscape Grid Spreadsheet (A4 Compact)</span>
                          <span className="text-[9px] font-black uppercase py-0.5 px-2 rounded-full bg-emerald-100 text-emerald-800">A4 Landscape</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                          Dense landscape snapshot optimized of standard small office paperwork bins. Hides actions panel icons for flat, executive display.
                        </p>
                      </div>
                    </label>

                    {/* OPTION 4: LANDSCAPE A0 Poster */}
                    <label 
                      className={`flex items-start gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all select-none hover:bg-slate-50/50 ${
                        exportFormat === 'grid-a0' 
                          ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600/20' 
                          : 'border-slate-200'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="exportFormat" 
                        value="grid-a0" 
                        checked={exportFormat === 'grid-a0'}
                        onChange={() => setExportFormat('grid-a0')}
                        className="mt-1 accent-indigo-650 cursor-pointer"
                        disabled={isExporting}
                      />
                      <div className="flex-grow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800">Poster Blueprint Planner (A0 Massive)</span>
                          <span className="text-[9px] font-black uppercase py-0.5 px-2 rounded-full bg-purple-100 text-purple-700">A0 Landscape</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                          Ultra high-resolution massive billboard canvas. Ideal for professional blueprint plotter prints, board room presentations, or pasting to staff walls.
                        </p>
                      </div>
                    </label>

                    {/* OPTION 5: GEMINI BULK UPLOAD CSV */}
                    <label 
                      className={`flex items-start gap-3.5 p-3.5 border rounded-xl cursor-pointer transition-all select-none hover:bg-slate-50/50 ${
                        exportFormat === 'csv' 
                          ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600/20' 
                          : 'border-slate-200'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="exportFormat" 
                        value="csv" 
                        checked={exportFormat === 'csv'}
                        onChange={() => setExportFormat('csv')}
                        className="mt-1 accent-indigo-650 cursor-pointer text-indigo-600"
                        disabled={isExporting}
                      />
                      <div className="flex-grow">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-800">Gemini Bulk Upload CSV (NUS Format)</span>
                          <span className="text-[9px] font-black uppercase py-0.5 px-2 rounded-full bg-indigo-100 text-indigo-700">CSV Export</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                          Exports the active project schedule as a standard comma-delimited bulk load template with multi-day consecutive blocks grouped perfectly into single rows and department codes mapped to 'NUS'.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* ADVANCED FILTER & SPECS EXPORT OPTIONS */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl flex flex-col gap-4.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    Target Export Filters & Notes
                  </span>

                  {/* 1. Department Selector Dropdown */}
                  <div className="flex flex-col gap-1.5 relative">
                    <label className="text-sm font-bold text-slate-700">
                      Export Department(s)
                    </label>
                    
                    {isDeptDropdownOpen && (
                      <div 
                        className="fixed inset-0 z-40 bg-transparent" 
                        onClick={() => setIsDeptDropdownOpen(false)} 
                      />
                    )}

                    <div className="relative z-50">
                      <button
                        type="button"
                        onClick={() => !isExporting && setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                        disabled={isExporting}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-medium flex items-center justify-between focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed text-left"
                      >
                        <span className="truncate pr-2 text-slate-700">{getExportDeptDisplayText()}</span>
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </button>

                      {isDeptDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto p-2.5 flex flex-col gap-1 shadow-indigo-150">
                          {/* Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1 px-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Multiple</span>
                            <button
                              type="button"
                              onClick={() => setExportDeptFilters(['ALL'])}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                            >
                              Reset to All
                            </button>
                          </div>

                          {/* Option -- ALL -- */}
                          <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={exportDeptFilters.includes('ALL')}
                              onChange={() => handleToggleExportDept('ALL')}
                              className="accent-indigo-600 w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
                            />
                            <span>-- ALL DEPARTMENTS --</span>
                          </label>

                          {/* List of departments */}
                          {departments.map((dept) => {
                            const isChecked = !exportDeptFilters.includes('ALL') && exportDeptFilters.includes(dept.code);
                            return (
                              <label 
                                key={dept.code} 
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleExportDept(dept.code)}
                                  className="accent-indigo-600 w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
                                />
                                <span 
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: dept.color || '#64748B' }} 
                                />
                                <span className="truncate">
                                  [{dept.code}] {dept.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Checkboxes for notes */}
                  <div className="flex flex-col gap-3 pt-1">
                    <div className="flex items-start gap-2.5">
                      <input 
                        type="checkbox" 
                        id="opt-include-notes" 
                        checked={includeNotesInExport}
                        onChange={(e) => setIncludeNotesInExport(e.target.checked)}
                        className="mt-0.5 accent-indigo-650 w-4 h-4 cursor-pointer"
                        disabled={isExporting}
                      />
                      <div className="flex flex-col">
                        <label htmlFor="opt-include-notes" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                          Print Operational Notes
                        </label>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Renders detailed instructions, blueprints and custom setup comments directly in the report document.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <input 
                        type="checkbox" 
                        id="opt-only-notes" 
                        checked={exportOnlyWithNotes}
                        onChange={(e) => setExportOnlyWithNotes(e.target.checked)}
                        className="mt-0.5 accent-indigo-650 w-4 h-4 cursor-pointer"
                        disabled={isExporting}
                      />
                      <div className="flex flex-col">
                        <label htmlFor="opt-only-notes" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                          Show Only Tasks with Notes
                        </label>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Filters the agenda checklist to solely include tasks that contain detailed workspace notes.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid Maps Specific Extra Options */}
                {exportFormat !== 'agenda' && exportFormat !== 'csv' && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                    <input 
                      type="checkbox" 
                      id="opt-contrast-grid" 
                      checked={highContrastGrid}
                      onChange={(e) => setHighContrastGrid(e.target.checked)}
                      className="mt-1 accent-indigo-650 w-4 h-4 cursor-pointer"
                      disabled={isExporting}
                    />
                    <div className="flex flex-col">
                      <label htmlFor="opt-contrast-grid" className="text-xs font-black text-slate-700 cursor-pointer select-none">
                        High Contrast Grid Outlines
                      </label>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-medium leading-normal">
                        Renders clear black grid lines over all day column headers instead of light slate lines. Improves visibility dramatically on physical monochrome photocopy machines.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  disabled={isExporting}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold select-none cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportToPDF}
                  disabled={isExporting}
                  className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-sm flex-shrink-0 select-none cursor-pointer transition-all active:scale-97 ${
                    isExporting 
                      ? 'bg-slate-400 border-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow shadow-indigo-600/10'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      {exportFormat === 'csv' ? 'Compiling CSV File...' : 'Rendering PDF file...'}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {exportFormat === 'csv' ? 'Download Bulk Load CSV' : 'Download Printable PDF'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* VIEW DETAILED TASK NOTES & SPECS MODAL */}
        {viewingNotesTask && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 no-print">
            {/* Backdrop click close */}
            <div className="absolute inset-0 cursor-default" onClick={() => setViewingNotesTask(null)} />
            
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="relative w-full max-w-lg bg-white border border-slate-250 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 text-left"
            >
              {/* Header Banner with Dept Color Accent */}
              <div 
                className="h-2 w-full" 
                style={{ backgroundColor: getDeptColor(viewingNotesTask.code) }}
              />
              
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white inline-block mb-1.5" style={{ backgroundColor: getDeptColor(viewingNotesTask.code) }}>
                    Department {viewingNotesTask.code}
                  </span>
                  <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-1.5 leading-tight">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Task Operations Specification
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingNotesTask(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-655 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[60vh]">
                {/* Task Details Title Statement */}
                <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                  <span className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block mb-1">Details & Assignment</span>
                  <p className="text-sm font-bold text-slate-850 leading-snug select-all">
                    {viewingNotesTask.details}
                  </p>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2.5 bg-slate-50/20 p-2.5 rounded-lg border border-slate-100">
                    <Calendar className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Target Date</span>
                      <span className="text-xs font-bold text-slate-700 font-mono block">{viewingNotesTask.date}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 bg-slate-50/20 p-2.5 rounded-lg border border-slate-100">
                    <Clock className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Time block</span>
                      <span className="text-xs font-bold text-slate-700 block">{viewingNotesTask.time || 'All Day'}</span>
                    </div>
                  </div>
                </div>

                {/* Start / End Times */}
                {(viewingNotesTask.startTime || viewingNotesTask.endTime) && (
                  <div className="bg-indigo-50/20 border border-indigo-100/50 rounded-xl p-4">
                    <span className="text-[9px] uppercase font-extrabold text-indigo-500 tracking-wider block mb-2">Duration Specific Limits</span>
                    <div className="grid grid-cols-2 gap-4">
                      {viewingNotesTask.startTime && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150">▶ Start</span>
                          <span className="text-xs font-black text-slate-700 font-mono">{viewingNotesTask.startTime}</span>
                        </div>
                      )}
                      {viewingNotesTask.endTime && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150">⏹ End</span>
                          <span className="text-xs font-black text-slate-700 font-mono">{viewingNotesTask.endTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dependency Link */}
                {viewingNotesTask.dependencyTaskId && (
                  <div className="bg-amber-50/25 border border-amber-100 rounded-xl p-4 flex gap-3 items-start">
                    <Layers className="w-4.5 h-4.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-grow">
                      <span className="text-[9px] uppercase font-extrabold text-amber-600 tracking-wider block mb-1">Pre-requisite Priority Dependency</span>
                      {(() => {
                        const dep = getDependencyTask(viewingNotesTask.dependencyTaskId);
                        if (dep) {
                          return (
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">[{dep.code}] {dep.details}</span>
                              <span className="text-[10px] text-slate-500 font-semibold font-mono block mt-0.5 font-bold">Scheduled Date: {dep.date}</span>
                            </div>
                          );
                        }
                        return <span className="text-xs font-semibold text-slate-500 italic block">Depends on an archived or unavailable task</span>;
                      })()}
                    </div>
                  </div>
                )}

                {/* Subtask Status */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status Indicator</span>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold">
                    <span className={`w-2 h-2 rounded-full ${
                      viewingNotesTask.status === 'Completed' ? 'bg-emerald-500' :
                      viewingNotesTask.status === 'In Progress' ? 'bg-indigo-500 animate-pulse' :
                      viewingNotesTask.status === 'Deferred' ? 'bg-amber-500' : 'bg-slate-400'
                    }`} />
                    {viewingNotesTask.status || 'Not Started'}
                  </div>
                  {viewingNotesTask.durationDays && viewingNotesTask.durationDays > 1 && (
                    <span className="text-xs text-slate-500 font-semibold">
                      Spans <strong className="text-slate-800">{viewingNotesTask.durationDays}</strong> operational days
                    </span>
                  )}
                </div>

                {/* Notes Container Block */}
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block mb-2">Detailed Notes & Setup Instructions</span>
                  {viewingNotesTask.notes ? (
                    <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 font-medium text-xs text-slate-700 whitespace-pre-line leading-relaxed select-all shadow-2xs">
                      {viewingNotesTask.notes}
                    </div>
                  ) : (
                    <div className="bg-slate-50/40 rounded-xl p-5 border border-dashed border-slate-200 text-center text-xs text-slate-450 font-medium italic">
                      No operational setup notes or instructions captured.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewingNotesTask(null)}
                  className="px-4 py-2 border border-slate-205 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = viewingNotesTask;
                      setViewingNotesTask(null);
                      // bridge to form update edit modal
                      onEditTask(t);
                    }}
                    className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/10 transition-transform active:scale-97"
                  >
                    <Edit3 className="w-4 h-4" />
                    Modify Task Specs
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
