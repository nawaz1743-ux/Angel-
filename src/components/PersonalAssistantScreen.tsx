/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CheckSquare,
  FileText,
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Info,
  BellRing,
  BellOff,
  Calendar,
  Clock,
  Edit3,
  X,
} from 'lucide-react';
import { TaskItem, NoteItem, ReminderItem } from '../types/assistant';
import { getLocalDateString, formatDisplayDate } from '../utils/assistant-logic';

export { formatDisplayDate };

interface PersonalAssistantScreenProps {
  tasks: TaskItem[];
  notes: NoteItem[];
  reminders: ReminderItem[];
  onAddTask: (title: string, priority: 'normal' | 'urgent') => void;
  onUpdateTask?: (id: string, updates: Partial<Omit<TaskItem, 'id'>>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAddNote: (title: string, content: string, category: 'personal' | 'work' | 'idea') => void;
  onDeleteNote: (id: string) => void;
  onAddReminder: (title: string, time: string, date: string) => void;
  onToggleReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
}

export const PersonalAssistantScreen: React.FC<PersonalAssistantScreenProps> = ({
  tasks,
  notes,
  reminders,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onAddNote,
  onDeleteNote,
  onAddReminder,
  onToggleReminder,
  onDeleteReminder,
}) => {
  const [subTab, setSubTab] = useState<'tasks' | 'notes' | 'reminders'>('tasks');

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'normal' | 'urgent'>('normal');

  // Selected task modal state
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPriority, setEditPriority] = useState<'normal' | 'urgent'>('normal');

  // Delete confirmation state
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);

  // New note form state
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<'personal' | 'work' | 'idea'>('personal');

  // New reminder form state
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('18:00');
  const [reminderDate, setReminderDate] = useState(() => getLocalDateString());

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle.trim(), taskPriority);
    setNewTaskTitle('');
  };

  const handleSaveTaskEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !editTitle.trim()) return;
    const updates = {
      title: editTitle.trim(),
      date: editDate || undefined,
      time: editTime || undefined,
      priority: editPriority,
    };
    if (onUpdateTask) {
      onUpdateTask(selectedTask.id, updates);
    }
    setSelectedTask({
      ...selectedTask,
      ...updates,
    });
    setIsEditingTask(false);
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    onAddNote(newNoteTitle.trim(), newNoteContent.trim(), noteCategory);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;
    onAddReminder(newReminderTitle.trim(), reminderTime, reminderDate);
    setNewReminderTitle('');
  };

  return (
    <div className="flex flex-col gap-4 pb-24 pt-3 px-4 max-w-md mx-auto animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-amber-400" />
          <span>Personal Assistant Organizer</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your tasks, notes, and reminders. Synchronized safely with local mobile storage.
        </p>

        {/* Sub-tabs switcher */}
        <div className="flex items-center gap-1.5 mt-3 bg-slate-950 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setSubTab('tasks')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'tasks'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tasks ({tasks.length})</span>
          </button>

          <button
            onClick={() => setSubTab('notes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'notes'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes ({notes.length})</span>
          </button>

          <button
            onClick={() => setSubTab('reminders')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'reminders'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Reminders ({reminders.length})</span>
          </button>
        </div>
      </div>

      {/* TASKS SUBTAB */}
      {subTab === 'tasks' && (
        <div className="flex flex-col gap-3">
          {/* Add task form */}
          <form
            onSubmit={handleCreateTask}
            className="flex flex-col gap-2 bg-slate-900/70 p-3 rounded-2xl border border-white/10"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Naya task likhein (e.g. Call Rahul at 5pm)..."
                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                aria-label="Add Task"
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Priority:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskPriority('normal')}
                  className={`px-2 py-0.5 rounded-md ${
                    taskPriority === 'normal'
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setTaskPriority('urgent')}
                  className={`px-2 py-0.5 rounded-md ${
                    taskPriority === 'urgent'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  Urgent
                </button>
              </div>
            </div>
          </form>

          {/* Task list */}
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-white/5">
                Koi task nahi hai abhi. Add your first task above!
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    task.completed
                      ? 'bg-slate-950/40 border-white/5 opacity-60'
                      : 'bg-slate-900/80 border-white/10 hover:border-amber-500/30'
                  }`}
                >
                  {/* Separate Completion Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task.id);
                    }}
                    aria-label={task.completed ? 'Mark task incomplete' : 'Mark task completed'}
                    className="p-1 rounded-lg hover:bg-white/5 shrink-0 transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-emerald-400 shrink-0" />
                    )}
                  </button>

                  {/* Task Title & Details Area (Tapping opens details, does NOT mark completed) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const rawTask = task as any;
                      const taskDate = task.date || rawTask.dueDate || rawTask.taskDate;
                      const taskTime = task.time || rawTask.dueTime || rawTask.taskTime;
                      setSelectedTask({ ...task, date: taskDate, time: taskTime });
                      setIsEditingTask(false);
                    }}
                    className="flex-1 px-3 cursor-pointer min-w-0"
                  >
                    <p
                      className={`text-xs font-medium truncate ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}
                    >
                      {task.title}
                    </p>

                    {(task.date || (task as any).dueDate || (task as any).taskDate || task.time || (task as any).dueTime || (task as any).taskTime) && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {(task.date || (task as any).dueDate || (task as any).taskDate) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-400/80 shrink-0" />
                            <span>{formatDisplayDate(task.date || (task as any).dueDate || (task as any).taskDate)}</span>
                          </span>
                        )}
                        {(task.time || (task as any).dueTime || (task as any).taskTime) && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400/80 shrink-0" />
                            <span>{task.time || (task as any).dueTime || (task as any).taskTime}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.priority === 'urgent' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                        Urgent
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rawTask = task as any;
                        const taskDate = task.date || rawTask.dueDate || rawTask.taskDate;
                        const taskTime = task.time || rawTask.dueTime || rawTask.taskTime;
                        setSelectedTask({ ...task, date: taskDate, time: taskTime });
                        setEditTitle(task.title);
                        setEditDate(taskDate || '');
                        setEditTime(taskTime || '');
                        setEditPriority(task.priority);
                        setIsEditingTask(true);
                      }}
                      aria-label="Edit Task"
                      className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                      title="Edit Task"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rawTask = task as any;
                        const taskDate = task.date || rawTask.dueDate || rawTask.taskDate;
                        const taskTime = task.time || rawTask.dueTime || rawTask.taskTime;
                        setTaskToDelete({ ...task, date: taskDate, time: taskTime });
                      }}
                      aria-label="Delete Task"
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Task Details & Edit Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-4 shadow-2xl relative text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  {isEditingTask ? 'Edit Task' : 'Task Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTask(null);
                  setIsEditingTask(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isEditingTask ? (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Title</label>
                  <p className="text-slate-100 font-semibold text-sm mt-0.5">{selectedTask.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Date</label>
                    <p className="text-slate-200 font-medium mt-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>{formatDisplayDate(selectedTask.date || (selectedTask as any).dueDate || (selectedTask as any).taskDate)}</span>
                    </p>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Time</label>
                    <p className="text-slate-200 font-medium mt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{selectedTask.time || (selectedTask as any).dueTime || (selectedTask as any).taskTime || 'Not set'}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Priority</label>
                    <div className="mt-1">
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold ${
                          selectedTask.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {selectedTask.priority === 'urgent' ? 'Urgent' : 'Normal'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Status</label>
                    <div className="mt-1 flex items-center gap-1">
                      {selectedTask.completed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300 font-semibold">Completed</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-300">Pending</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleTask(selectedTask.id);
                      setSelectedTask({ ...selectedTask, completed: !selectedTask.completed });
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedTask.completed
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selectedTask.completed ? 'Mark Pending' : 'Mark Complete'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTitle(selectedTask.title);
                      setEditDate(selectedTask.date || '');
                      setEditTime(selectedTask.time || '');
                      setEditPriority(selectedTask.priority);
                      setIsEditingTask(true);
                    }}
                    className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1 text-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskToDelete(selectedTask);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveTaskEdit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Task Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Time</label>
                    <input
                      type="text"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      placeholder="e.g. 9:00 AM"
                      className="w-full mt-1 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Priority</label>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setEditPriority('normal')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        editPriority === 'normal'
                          ? 'bg-slate-700 text-white border border-slate-600'
                          : 'bg-slate-950 text-slate-400'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPriority('urgent')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        editPriority === 'urgent'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-slate-950 text-slate-400'
                      }`}
                    >
                      Urgent
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTask(false)}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-1.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Task Confirmation Dialog Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl w-full max-w-sm p-4 shadow-2xl relative text-left">
            <div className="flex items-center gap-2.5 text-rose-400 border-b border-white/10 pb-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Task?</h3>
                <p className="text-[11px] text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-200 font-medium bg-slate-950/60 p-3 rounded-xl border border-white/5 mb-4 truncate">
              "{taskToDelete.title}"
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTask(taskToDelete.id);
                  if (selectedTask?.id === taskToDelete.id) {
                    setSelectedTask(null);
                  }
                  setTaskToDelete(null);
                }}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTES SUBTAB */}
      {subTab === 'notes' && (
        <div className="flex flex-col gap-3">
          {/* Add note form */}
          <form
            onSubmit={handleCreateNote}
            className="flex flex-col gap-2 bg-slate-900/70 p-3 rounded-2xl border border-white/10"
          >
            <input
              type="text"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Note Title..."
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <textarea
              rows={2}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Note Details, thoughts, or ideas..."
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <div className="flex items-center justify-between">
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as any)}
                aria-label="Note category"
                className="bg-slate-950 border border-white/10 rounded-lg text-xs text-slate-300 px-2 py-1"
              >
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="idea">Idea</option>
              </select>

              <button
                type="submit"
                aria-label="Save Note"
                className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs active:scale-95 transition-all"
              >
                Save Note
              </button>
            </div>
          </form>

          {/* Notes list */}
          <div className="space-y-2.5">
            {notes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-white/5">
                Koi note nahi hai abhi. Add your first note!
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col gap-1 relative"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white">{note.title}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-semibold uppercase">
                        {note.category}
                      </span>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        aria-label="Delete Note"
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap mt-0.5">
                    {note.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* REMINDERS SUBTAB */}
      {subTab === 'reminders' && (
        <div className="flex flex-col gap-3">
          {/* Notification Permission & Background Limitations Banner */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-blue-500/20 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
                {typeof Notification !== 'undefined' && Notification.permission === 'granted' ? (
                  <>
                    <BellRing className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Browser Notifications: Allowed</span>
                  </>
                ) : typeof Notification !== 'undefined' && Notification.permission === 'denied' ? (
                  <>
                    <BellOff className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-rose-300">Browser Notifications: Blocked</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">Browser Notifications: Not Set</span>
                  </>
                )}
              </span>

              {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
                <button
                  type="button"
                  onClick={() => Notification.requestPermission().catch(() => {})}
                  className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold"
                >
                  Enable
                </button>
              )}
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <span>
                <strong>In-App Reminders:</strong> Angel plays a synthesized audio chime, vibrates, and displays an alert popup whenever a reminder is due while the app is open. Native Android background alarms while the app is completely closed require native Android AlarmManager integration.
              </span>
            </p>
          </div>

          <form
            onSubmit={handleCreateReminder}
            className="flex flex-col gap-2 bg-slate-900/70 p-3 rounded-2xl border border-white/10"
          >
            <input
              type="text"
              value={newReminderTitle}
              onChange={(e) => setNewReminderTitle(e.target.value)}
              placeholder="Reminder (e.g. Call Mom, Buy Milk)..."
              className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              aria-label="Set Reminder"
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs active:scale-95 transition-all"
            >
              Set Reminder
            </button>
          </form>

          {/* Reminders list */}
          <div className="space-y-2">
            {reminders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-white/5">
                Koi active reminder nahi hai.
              </div>
            ) : (
              reminders.map((rem) => {
                const isOverdue = rem.dueTimestamp <= Date.now();
                return (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-white/10"
                  >
                    <div className="flex items-center gap-2.5">
                      <Bell className={`w-4 h-4 ${rem.active ? 'text-blue-400' : 'text-slate-500'}`} />
                      <div>
                        <p className="text-xs font-semibold text-white">{rem.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {rem.date} at {rem.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleReminder(rem.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                          rem.notified
                            ? 'bg-amber-500/20 text-amber-300'
                            : rem.active
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {rem.notified ? 'Triggered' : rem.active ? 'Active' : 'Muted'}
                      </button>
                      <button
                        onClick={() => onDeleteReminder(rem.id)}
                        aria-label="Delete Reminder"
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
