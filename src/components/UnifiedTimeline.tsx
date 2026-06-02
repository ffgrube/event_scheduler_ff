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
  Check,
  Download,
  Eye,
  Settings
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

  // Generate the timeline dates list based on setup settings
  const dateRange = generateDateRange(settings.startDate, settings.endDate);

  // Filter tasks based on active selection filter
  const filteredTasks = tasks.filter(task => {
    if (selectedDeptFilter === 'ALL') return true;
    return task.code === selectedDeptFilter;
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

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'grid-a0' | 'grid-a3' | 'grid-a4' | 'agenda'>('agenda');
  const [highContrastGrid, setHighContrastGrid] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const showReadOnlyLayout = isReadOnly || isGeneratingPDF;

  const getDeptColor = (code: string) => {
    const dept = departments.find(d => d.code.toUpperCase() === code.toUpperCase());
    return dept ? dept.color : (PDF_SAFE_COLORS[code] || '#64748B');
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
        const dayTasks = filteredTasks.filter(t => t.date === dayDate);
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
              subtasks: item.subtasks
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
          if (cursorY > pageHeight - 25) {
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
          cursorY += 6 + (lineHeightMultiplier * 3);
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
      if (clonedTableContainer) {
        clonedTableContainer.style.width = `${measuredScrollWidth}px`;
      }

      // Brief delay to permit document element recalculation
      await new Promise((resolve) => setTimeout(resolve, 400));

      const captureScale = format === 'grid-a0' ? 2 : format === 'grid-a3' ? 1.5 : 1.2;

      // 3. Complete Width Canvas Metrics
      const canvas = await html2canvas(clonedElement, {
        width: clonedElement.scrollWidth,
        height: clonedElement.scrollHeight,
        windowWidth: clonedElement.scrollWidth, // Forces html2canvas to render at ultra-wide resolution desktop scale
        scale: captureScale, // Keeps text definitions exceptionally sharp
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // 4. Proportional PDF Canvas Stitching
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [imgWidth, imgHeight] // Perfectly hugs the canvas dimensions
      });

      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      
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
    if (exportFormat === 'agenda') {
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

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-medium shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Task Count: <strong className="text-slate-800">{filteredTasks.length}</strong> sorted</span>
          </div>
        </div>
      </div>

      {/* Synchronized Table Layout */}
      <div id="scheduler-table-container" className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[1100px]">
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff', borderBottom: '1px solid #334155' }}>
              {/* Left Side Static Headers with perfect width definitions */}
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
                className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-r w-12 min-w-[48px] max-w-[48px] sticky left-0 z-30"
              >
                Item
              </th>
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
                className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider border-r w-16 min-w-[64px] max-w-[64px] sticky left-12 z-30"
              >
                CODE
              </th>
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
                className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider border-r w-32 min-w-[128px] max-w-[128px] sticky left-28 z-30"
              >
                Date
              </th>
              <th 
                style={{ backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
                className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider border-r w-[460px] min-w-[460px] sticky left-60 z-30"
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
                    style={{ backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }}
                    className="text-center text-[10px] font-extrabold uppercase border-r py-3 px-2 tracking-wide min-w-[140px] align-top"
                  >
                    <div style={{ color: '#a5b4fc' }} className="text-[10px] font-bold">DAY {dayIdx + 1}</div>
                    <div className="text-[11px] font-extrabold text-white mt-0.5">{formatDateShort(dayDate)}</div>
                    
                    {/* CUSTOM DAY NAME & NOTE FIELDS */}
                    {showReadOnlyLayout ? (
                      <div className="mt-2 space-y-1 normal-case text-left font-sans select-all font-normal">
                        {dayName && (
                          <div className="text-[10px] font-bold text-indigo-300 truncate max-w-[130px] text-center" title={dayName}>
                            ● {dayName}
                          </div>
                        )}
                        {dayNote && (
                          <div className="text-[9px] text-slate-400 italic break-words leading-tight max-w-[130px] text-center" title={dayNote}>
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
                            className="w-full text-[9.5px] font-semibold bg-[#1e293b] border border-slate-700 hover:border-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 text-white rounded px-1.5 py-1 text-center placeholder-slate-500 focus:outline-none transition-all"
                            title="Name this Day (e.g. Press Day, Show Start)"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Potential notes"
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
                            className="w-full text-[9px] bg-[#1e293b]/70 border border-slate-750 hover:border-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 text-slate-300 rounded px-1.5 py-0.5 text-center placeholder-slate-550 italic focus:outline-none transition-all font-medium"
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
                      backgroundColor: isHovered ? '#f1f5f9' : '#ffffff'
                    }}
                  >
                    {/* 1. Item Label */}
                    <td 
                      style={{
                        backgroundColor: isHovered ? '#f1f5f9' : '#ffffff',
                        borderRight: '1px solid #e2e8f0'
                      }}
                      className="px-3 py-2 text-center text-[11px] font-mono font-bold text-slate-400 sticky left-0 z-20 w-12 min-w-[48px] max-w-[48px]"
                    >
                      {row.itemNumberLabel}
                    </td>

                    {/* 2. Department CODE dropdown */}
                    <td 
                      style={{
                        backgroundColor: isHovered ? '#f1f5f9' : '#ffffff',
                        borderRight: '1px solid #e2e8f0'
                      }}
                      className="px-2 py-2 text-center sticky left-12 z-20 w-16 min-w-[64px] max-w-[64px]"
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
                            <div className={`w-full px-1.5 py-1 font-semibold text-slate-700 select-all leading-tight break-words ${isGeneratingPDF ? 'text-[10px]' : 'text-xs'}`} title={task.details}>
                              {task.details}
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
                                if (showReadOnlyLayout) return;
                                onEditTask(task);
                              }}
                              style={{
                                borderRight: '1px solid #e2e8f0',
                                backgroundColor: '#f0f4ff', // lightly highlighted active track line
                                padding: '6px'
                              }}
                              className={`text-center align-middle transition-all relative ${
                                showReadOnlyLayout ? 'cursor-default' : 'cursor-pointer'
                              }`}
                            >
                              <div
                                style={{ backgroundColor: getDeptColor(task.code) }}
                                className={`w-full min-h-[38px] rounded-lg text-white font-extrabold flex flex-col items-center justify-center shadow-xs px-2.5 py-1.5 transition-transform ${
                                  showReadOnlyLayout ? 'cursor-default' : 'hover:scale-[1.01] active:scale-95 cursor-pointer'
                                }`}
                                title={`${task.code}: ${task.details} (${task.time || 'All Day'}) - Spans ${duration} day(s)${showReadOnlyLayout ? '' : ' - Click to edit'}`}
                              >
                                <span className="text-[10px] tracking-widest uppercase font-black">{task.code}</span>
                                <span className="text-[9px] opacity-90 mt-0.5 font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                  {task.time || 'All Day'}
                                </span>
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
                                  code: selectedDeptFilter !== 'ALL' ? selectedDeptFilter : task.code,
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
                                backgroundColor: isHovered ? '#f8fafc' : '#ffffff'
                              }}
                              className={`p-2 text-center transition-all relative min-w-[120px] h-[48px] ${
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
                  </div>
                </div>

                {/* Grid Maps Specific Extra Options */}
                {exportFormat !== 'agenda' && (
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
                      Rendering PDF file...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Printable PDF
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
