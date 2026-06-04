/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Task, Department, TaskStatus } from '../types';
import { 
  Sparkles, 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Check, 
  Copy, 
  AlertCircle, 
  FileSpreadsheet, 
  FileText 
} from 'lucide-react';

interface BulkImportProps {
  departments: Department[];
  onBulkImport: (importedTasks: Task[]) => void;
  showToast: (message: string, type?: 'success' | 'info') => void;
  defaultDate?: string;
}

const TEMPLATE_EXAMPLE = `LOG,2026-07-06,06:30,Main load-in bay reserved
LX,2026-07-06,14:00,Motor hang and structural safety point lock
AV,2026-07-06,19:15,Night line-array power loom runs
STG,2026-07-07,09:00,Scenic deck framing assemble
AV,2026-07-07,,ALL DAY: Audio console positioning & sound check
MKT,2026-07-07,,ALL DAY: Venue exterior graphic wraps install
LX,2026-07-08,10:30,Profiles circuit check and dimming patch`;

export default function BulkImport({ departments, onBulkImport, showToast, defaultDate = '2026-07-06' }: BulkImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [parsedPreviewCount, setParsedPreviewCount] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);

  // Parse strings and count valid tasks in real-time
  useEffect(() => {
    if (!importText.trim()) {
      setParsedPreviewCount(0);
      return;
    }

    const lines = importText.split(/\r?\n/);
    let count = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
        const separator = trimmed.includes('\t') ? '\t' : ',';
        const parts = trimmed.split(separator);
        if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
          count++;
        }
      }
    }
    setParsedPreviewCount(count);
  }, [importText]);

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(TEMPLATE_EXAMPLE);
    setCopySuccess(true);
    showToast('Template copied! Paste it in the textarea below.', 'success');
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!importText.trim()) {
      showToast('Please paste or write CSV data before loading.', 'info');
      return;
    }

    const lines = importText.split(/\r?\n/);
    const newTasks: Task[] = [];
    let skippedCount = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      // Skip empty or comment lines
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        return;
      }

      const separator = trimmed.includes('\t') ? '\t' : ',';
      const parts = trimmed.split(separator);

      if (parts.length < 2) {
        skippedCount++;
        return;
      }

      let code = parts[0].trim().toUpperCase();
      let date = parts[1].trim().replace(/\//g, '-'); // Normalize format slashes to hyphens

      // Skip CSV header line safely if user copies the whole CSV template back in
      if (code === 'NUS' && (date.includes('_DATE') || date.includes('DATE') || date.includes('Start_Date') || date.includes('Start Date'))) {
        return;
      }

      let time = '';
      let details = '';
      let durationDays = 1; // Default fallback to 1 day

      // Validate date match YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        // Fallback to defaultDate if the format is invalid but we have a text line
        date = defaultDate;
      }

      // If the code is completely empty, skip or fallback to 'GEN'
      if (!code) {
        code = 'GEN';
      }

      // Check if the 3rd column is a valid time format
      const thirdPart = parts[2] ? parts[2].trim() : '';
      const isTime = /^\d{1,2}:\d{2}$/.test(thirdPart);

      if (isTime || thirdPart === '') {
        time = thirdPart;
        
        // If we have a 5th column and the last element is a valid number, parse it as duration
        if (parts.length >= 5 && parts[parts.length - 1] && !isNaN(parseInt(parts[parts.length - 1].trim(), 10))) {
          durationDays = Math.max(1, parseInt(parts[parts.length - 1].trim(), 10));
          details = parts.slice(3, parts.length - 1).join(separator).trim();
        } else {
          details = parts.length >= 4 ? parts.slice(3).join(separator).trim() : `Scheduled task [${code}]`;
        }
      } else {
        // No valid time, treat 3rd column as details
        time = '';
        // If the last column of 4 or more is a number duration
        if (parts.length >= 4 && parts[parts.length - 1] && !isNaN(parseInt(parts[parts.length - 1].trim(), 10))) {
          durationDays = Math.max(1, parseInt(parts[parts.length - 1].trim(), 10));
          details = parts.slice(2, parts.length - 1).join(separator).trim();
        } else {
          details = parts.length >= 3 ? parts.slice(2).join(separator).trim() : `Staging task [${code}]`;
        }
      }

      // De-quote text strings if CSV has outer quotes
      if (details.startsWith('"') && details.endsWith('"')) {
        details = details.substring(1, details.length - 1).trim();
      }

      // Create Task instance
      const randomId = Math.random().toString(36).substr(2, 4);
      const newTask: Task = {
        id: `task-${Date.now()}-${index}-${randomId}`,
        code,
        date,
        time,
        details: details || `Staging task details`,
        status: 'Not Started',
        durationDays
      };

      newTasks.push(newTask);
    });

    if (newTasks.length === 0) {
      showToast('Could not parse any valid tasks. Check format.', 'info');
      return;
    }

    onBulkImport(newTasks);
    setImportText('');
    setIsOpen(false);
    
    let message = `Successfully imported ${newTasks.length} tasks and auto-sorted timeline!`;
    if (skippedCount > 0) {
      message += ` (${skippedCount} columns skipped due to formatting)`;
    }
    showToast(message, 'success');
  };

  return (
    <div id="gemini-bulk-import-card" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Accordion Trigger Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left select-none focus:outline-none focus:bg-slate-50/50 cursor-pointer"
      >
        <div id="bulk-import-heading" className="flex items-center gap-2.5">
          <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Gemini Bulk Import</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Paste comma/tab delimited event charts instantly</p>
          </div>
        </div>
        <div className="text-slate-400">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Accordion Expandable UI */}
      {isOpen && (
        <div className="border-t border-slate-100 p-5 bg-slate-50/30 space-y-4">
          {/* Information & Template Box */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="block text-[11px] font-bold text-indigo-900 uppercase tracking-tight">Standard CSV Format Structure</span>
                <span className="block text-[10.5px] leading-relaxed text-indigo-750 font-medium">
                  Use this generator template format with Gemini or sheets. Commas or tabs split items.
                </span>
                <span className="block text-[10px] font-mono text-indigo-600 font-bold mt-1">
                  CODE, YYYY-MM-DD, HH:MM, Task Details
                </span>
              </div>
            </div>

            {/* Template Sample Area */}
            <div className="relative mt-2">
              <pre className="text-[9.5px]/[14px] font-mono text-slate-500 bg-white border border-slate-200 rounded-md p-2.5 overflow-x-auto max-h-[140px] select-all">
                {TEMPLATE_EXAMPLE}
              </pre>
              <button
                type="button"
                onClick={handleCopyTemplate}
                className="absolute top-2 right-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-600 px-1.5 py-1 rounded text-[9.5px] font-semibold flex items-center gap-1 cursor-pointer select-none"
                title="Copy template block"
              >
                {copySuccess ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copySuccess ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Form Textarea */}
          <form onSubmit={handleImport} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="bulk-pasted-data" className="block text-xs font-semibold text-slate-600 flex justify-between items-center">
                <span>Pasted Event Data Block</span>
                <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Delimiter: Comma ( , ) or Tab
                </span>
              </label>
              <textarea
                id="bulk-pasted-data"
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste code blocks here... E.g.&#10;LOG,2026-07-06,06:30,Main load-in bay&#10;LX,2026-07-06,,ALL DAY: Cable runs"
                className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg bg-white shadow-inner focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none leading-normal resize-y"
              />
            </div>

            {/* Preview Status & Loading Button */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[10.5px] font-semibold text-slate-500">
                {parsedPreviewCount > 0 ? (
                  <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Parsed {parsedPreviewCount} task{parsedPreviewCount > 1 ? 's' : ''} ready to load
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-sans">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                    Pasted items count details
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={parsedPreviewCount === 0}
                className={`py-2 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer ${
                  parsedPreviewCount > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                    : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Upload className="w-4 h-4 animate-pulse" />
                Bulk Load Timeline
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
