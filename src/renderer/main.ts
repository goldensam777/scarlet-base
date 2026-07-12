import {
  createIcons,
  Calendar,
  BarChart2,
  Clock,
  Trash2,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  Tag,
  X,
  Pencil,
  Menu,
  Sidebar,
  Cake,
  Bell,
  Bold,
  Italic,
  Heading,
  Quote,
  List,
  ListOrdered,
  Link,
  Image,
  Eye,
  Columns,
  Maximize
} from 'lucide'

import MarkdownIt from 'markdown-it'
import EasyMDE from 'easymde'
import DOMPurify from 'dompurify'
import 'easymde/dist/easymde.min.css'
import { AgendaNote, AgendaNotesManager } from './agenda.notes'

const ALL_ICONS = {
  Calendar,
  BarChart2,
  Clock,
  Trash2,
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  Tag,
  X,
  Pencil,
  Menu,
  Sidebar,
  Cake,
  Bell,
  Bold,
  Italic,
  Heading,
  Quote,
  List,
  ListOrdered,
  Link,
  Image,
  Eye,
  Columns,
  Maximize
};

interface Task {
  id: string;
  title: string;
  detail: string;
  date: string;
  time: string;
  endTime?: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  list: string;
  type?: 'task' | 'event' | 'birthday' | 'reminder';
}

interface State {
  view: 'month' | 'week' | 'day' | 'today' | 'notes';
  cursor: Date;
  selectedDate: string;
  editingTaskId: string | null;
  activeList: string;
  completedTasksOpen: boolean;
  renamingCalName: string | null;
  renamingListName: string | null;
  selectedNoteId: string | null;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
}

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DAYS_FR_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

interface CalendarCategory {
  name: string;
  color: string;
  checked: boolean;
}

// Initial defaults
let calendars: CalendarCategory[] = [
  { name: 'Perso', color: '#38bdf8', checked: true },
  { name: 'Travail', color: '#e0a458', checked: true },
  { name: 'Loisirs', color: '#81c995', checked: true },
  { name: 'Important', color: '#e63946', checked: true }
];

let lists: string[] = ['Ma liste', 'Professionnel', 'Personnel'];
let tasks: Task[] = [];
let activeTheme = 'orange-terminal';

const state: State = {
  view: 'month',
  cursor: new Date(),
  selectedDate: todayISO(),
  editingTaskId: null,
  activeList: 'Ma liste',
  completedTasksOpen: false,
  renamingCalName: null,
  renamingListName: null,
  selectedNoteId: null,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false
};

const notesManager = new AgendaNotesManager();

// Database persistence helpers using Electron IPC file storage (~/.taskflow/db.json)
async function syncDatabase(): Promise<void> {
  const dbData = {
    tasks,
    calendars,
    lists,
    theme: activeTheme,
    activeList: state.activeList,
    view: state.view,
    leftSidebarCollapsed: state.leftSidebarCollapsed,
    rightSidebarCollapsed: state.rightSidebarCollapsed
  };
  try {
    await (window as any).electronAPI.saveData(dbData);
  } catch (e) {
    console.error('Failed to save to database file', e);
  }
}

function saveTasks(updatedTasks: Task[]): void {
  tasks = updatedTasks;
  syncDatabase();
}

function saveCalendars(updatedCals: CalendarCategory[]): void {
  calendars = updatedCals;
  syncDatabase();
}

function saveLists(updatedLists: string[]): void {
  lists = updatedLists;
  syncDatabase();
}
let modalPriority: 'low' | 'medium' | 'high' = 'medium';

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return iso(new Date());
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function startOfWeek(d: Date): Date {
  const nd = new Date(d);
  const day = nd.getDay(); // 0 = sun
  const diff = day === 0 ? -6 : 1 - day;
  nd.setDate(nd.getDate() + diff);
  return nd;
}

function fmtLong(d: Date): string {
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function uid(): string {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function genId(): string {
  return uid();
}

function getFilteredTasks(): Task[] {
  const activeCalNames = new Set(calendars.filter(c => c.checked).map(c => c.name));
  return tasks.filter(t => activeCalNames.has(t.category));
}

function tasksForDate(dISO: string): Task[] {
  return getFilteredTasks()
    .filter(t => t.date === dISO)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

function toggleDone(id: string): void {
  const t = tasks.find(item => item.id === id);
  if (t) {
    t.done = !t.done;
    saveTasks(tasks);
    render();
  }
}

function deleteTask(id: string): void {
  tasks = tasks.filter(item => item.id !== id);
  saveTasks(tasks);
  render();
}

// ---- DOM Elements ----
const elTitle = document.getElementById('viewTitle') as HTMLElement;
const elViewport = document.getElementById('calendarViewport') as HTMLElement;
const elActiveTasksList = document.getElementById('activeTasksList') as HTMLUListElement;
const elCompletedTasksList = document.getElementById('completedTasksList') as HTMLUListElement;
const elCompletedCount = document.getElementById('completedCount') as HTMLElement;
const elModal = document.getElementById('taskModal') as HTMLElement;

function render(): void {
  // 1. Update Calendar Header Title
  if (state.view === 'month') {
    elTitle.textContent = `${MONTHS_FR[state.cursor.getMonth()]} ${state.cursor.getFullYear()}`;
  } else if (state.view === 'week') {
    const start = startOfWeek(state.cursor);
    const end = addDays(start, 6);
    elTitle.textContent = `${start.getDate()} ${MONTHS_FR[start.getMonth()].slice(0, 4)} – ${end.getDate()} ${MONTHS_FR[end.getMonth()]} ${end.getFullYear()}`;
  } else if (state.view === 'day') {
    elTitle.textContent = fmtLong(state.cursor);
  } else if (state.view === 'today') {
    elTitle.textContent = "aujourd'hui.";
  } else if (state.view === 'notes') {
    elTitle.textContent = "notes.";
  }

  // 2. Update View Switched buttons
  document.querySelectorAll('.view-switch-group .view-btn').forEach(b => {
    const btn = b as HTMLButtonElement;
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });

  // 3. Render Calendar Viewport
  if (state.view === 'month') {
    renderMonthView();
  } else if (state.view === 'week') {
    renderWeekView();
  } else if (state.view === 'day') {
    renderDayView();
  } else if (state.view === 'today') {
    renderTodayLayoutView();
  } else if (state.view === 'notes') {
    renderNotesView();
  }

  // 4. Render Left Sidebar Widgets (Mini-cal & Filters)
  renderMiniCalendar();
  renderFilters();

  // 5. Render Right Sidebar Tasks
  renderTasksSidebar();

  createIcons({
    icons: ALL_ICONS
  });
}

// ---- 1. Mini Calendar Renderer ----
function renderMiniCalendar(): void {
  const miniTitle = document.getElementById('miniCalTitle') as HTMLElement;
  const miniBody = document.getElementById('miniCalBody') as HTMLElement;
  if (!miniTitle || !miniBody) return;

  const d = new Date(state.cursor);
  miniTitle.textContent = `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;

  const year = d.getFullYear();
  const month = d.getMonth();

  // First day of month
  const firstDay = new Date(year, month, 1);
  let startIdx = firstDay.getDay() - 1; // Mon = 0
  if (startIdx < 0) startIdx = 6; // Sun = 6

  // Total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Total days in previous month
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  miniBody.innerHTML = '';

  // Previous month padding days
  for (let i = startIdx - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const cell = document.createElement('div');
    cell.className = 'mini-cal-day prev-next';
    cell.textContent = String(dayNum);
    cell.addEventListener('click', () => {
      state.cursor.setMonth(state.cursor.getMonth() - 1);
      state.cursor.setDate(dayNum);
      render();
    });
    miniBody.appendChild(cell);
  }

  // Active month days
  for (let i = 1; i <= totalDays; i++) {
    const cell = document.createElement('div');
    const cellISO = iso(new Date(year, month, i));
    const isToday = cellISO === todayISO();
    const isActive = cellISO === iso(state.cursor);

    cell.className = 'mini-cal-day' + (isToday ? ' today' : '') + (isActive ? ' active' : '');
    cell.textContent = String(i);
    cell.addEventListener('click', () => {
      state.cursor.setDate(i);
      state.selectedDate = cellISO;
      render();
    });
    miniBody.appendChild(cell);
  }

  // Next month padding days
  const totalGridCells = 42; // 6 rows of 7 days
  const remainingCells = totalGridCells - (startIdx + totalDays);
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'mini-cal-day prev-next';
    cell.textContent = String(i);
    cell.addEventListener('click', () => {
      state.cursor.setMonth(state.cursor.getMonth() + 1);
      state.cursor.setDate(i);
      render();
    });
    miniBody.appendChild(cell);
  }
}

function deleteCalendar(calName: string): void {
  const index = calendars.findIndex(c => c.name === calName);
  if (index > 0) {
    calendars.splice(index, 1);
    saveCalendars(calendars);
    
    const defaultCat = calendars[0] ? calendars[0].name : 'Travail';
    tasks.forEach(t => {
      if (t.category === calName) {
        t.category = defaultCat;
      }
    });
    saveTasks(tasks);
    
    render();
  }
}

function renameCalendar(oldName: string, newName: string): void {
  if (!newName || oldName === newName) {
    state.renamingCalName = null;
    render();
    return;
  }
  // Check duplicates
  if (calendars.some(c => c.name.toLowerCase() === newName.toLowerCase())) {
    state.renamingCalName = null;
    render();
    return;
  }

  // Update tasks category
  tasks.forEach(t => {
    if (t.category === oldName) {
      t.category = newName;
    }
  });
  saveTasks(tasks);

  // Update calendar name
  const cal = calendars.find(c => c.name === oldName);
  if (cal) {
    cal.name = newName;
    saveCalendars(calendars);
  }

  state.renamingCalName = null;
  render();
}

function renderFilters(): void {
  const filtersList = document.getElementById('calendarFilters');
  if (!filtersList) return;
  filtersList.innerHTML = '';
  
  calendars.forEach(cal => {
    const isDeletable = calendars.indexOf(cal) > 0;
    const wrapper = document.createElement('div');
    wrapper.className = 'filter-item-wrapper';
    
    if (cal.name === state.renamingCalName) {
      wrapper.innerHTML = `
        <div class="filter-item-rename-container">
          <input type="text" class="agenda-rename-input" value="${escapeHtml(cal.name)}" maxlength="20">
          <button class="inline-btn save btn-save-cal-rename" title="Enregistrer"><i data-lucide="check"></i></button>
          <button class="inline-btn cancel btn-cancel-cal-rename" title="Annuler"><i data-lucide="x"></i></button>
        </div>
      `;
      
      const renameInput = wrapper.querySelector('.agenda-rename-input') as HTMLInputElement;
      setTimeout(() => {
        renameInput?.focus();
        renameInput?.select();
      }, 0);

      renameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          renameCalendar(cal.name, renameInput.value.trim());
        } else if (e.key === 'Escape') {
          state.renamingCalName = null;
          render();
        }
      });
      
      wrapper.querySelector('.btn-save-cal-rename')?.addEventListener('click', (e) => {
        e.stopPropagation();
        renameCalendar(cal.name, renameInput.value.trim());
      });
      
      wrapper.querySelector('.btn-cancel-cal-rename')?.addEventListener('click', (e) => {
        e.stopPropagation();
        state.renamingCalName = null;
        render();
      });
    } else {
      wrapper.innerHTML = `
        <label class="filter-item">
          <input type="checkbox" ${cal.checked ? 'checked' : ''} data-name="${cal.name}">
          <span class="checkbox-dot" style="background-color: ${cal.color};"></span>
          <span class="filter-label-text">${escapeHtml(cal.name)}</span>
        </label>
        <div class="filter-item-actions">
          <input type="color" class="agenda-color-input" data-name="${cal.name}" value="${cal.color}" title="Modifier la couleur">
          <button class="agenda-rename-btn" data-name="${cal.name}" title="Renommer l'agenda"><i data-lucide="pencil"></i></button>
          ${isDeletable ? `<button class="agenda-delete-btn" data-name="${cal.name}" title="Supprimer l'agenda"><i data-lucide="x"></i></button>` : ''}
        </div>
      `;
      
      const cb = wrapper.querySelector('input[type=checkbox]') as HTMLInputElement;
      cb.addEventListener('change', () => {
        cal.checked = cb.checked;
        saveCalendars(calendars);
        render();
      });
      
      const colorInp = wrapper.querySelector('.agenda-color-input') as HTMLInputElement;
      colorInp.addEventListener('change', () => {
        cal.color = colorInp.value;
        saveCalendars(calendars);
        render();
      });
      
      const renameBtn = wrapper.querySelector('.agenda-rename-btn');
      renameBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        state.renamingCalName = cal.name;
        render();
      });
      
      const delBtn = wrapper.querySelector('.agenda-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteCalendar(cal.name);
        });
      }
    }
    
    filtersList.appendChild(wrapper);
  });
}

// ---- 2. Month View Renderer ----
function renderMonthView(): void {
  const monthView = document.createElement('div');
  monthView.className = 'monthView';

  // Month header (Days of week)
  const monthHead = document.createElement('div');
  monthHead.className = 'monthHead';
  const DAYS_FR_SHORT_MON = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  DAYS_FR_SHORT_MON.forEach(d => {
    const cell = document.createElement('div');
    cell.textContent = d;
    monthHead.appendChild(cell);
  });
  monthView.appendChild(monthHead);

  const grid = document.createElement('div');
  grid.className = 'monthGrid';

  const d = new Date(state.cursor);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDay = new Date(year, month, 1);
  let startIdx = firstDay.getDay() - 1;
  if (startIdx < 0) startIdx = 6;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Helper to handle cell click
  const handleCellClick = (cellDate: string) => {
    state.selectedDate = cellDate;
    openCreateModal(cellDate);
  };

  // Render cells
  // Previous month padding
  for (let i = startIdx - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const prevDate = new Date(year, month - 1, dayNum);
    const cellDateISO = iso(prevDate);
    
    const cell = document.createElement('div');
    cell.className = 'monthCell prev-next';
    cell.innerHTML = `<div class="monthCellNum">${dayNum}</div>`;
    
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'monthCellEvents';
    renderEventsPills(cellDateISO, eventsContainer);
    cell.appendChild(eventsContainer);

    cell.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cal-event-pill')) return;
      handleCellClick(cellDateISO);
    });
    grid.appendChild(cell);
  }

  // Active month days
  for (let i = 1; i <= totalDays; i++) {
    const cellDateISO = iso(new Date(year, month, i));
    const isToday = cellDateISO === todayISO();

    const cell = document.createElement('div');
    cell.className = 'monthCell' + (isToday ? ' isToday' : '');
    cell.innerHTML = `<div class="monthCellNum">${i}</div>`;

    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'monthCellEvents';
    renderEventsPills(cellDateISO, eventsContainer);
    cell.appendChild(eventsContainer);

    cell.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cal-event-pill')) return;
      handleCellClick(cellDateISO);
    });
    grid.appendChild(cell);
  }

  // Next month padding
  const totalGridCells = 42;
  const remainingCells = totalGridCells - (startIdx + totalDays);
  for (let i = 1; i <= remainingCells; i++) {
    const nextDate = new Date(year, month + 1, i);
    const cellDateISO = iso(nextDate);

    const cell = document.createElement('div');
    cell.className = 'monthCell prev-next';
    cell.innerHTML = `<div class="monthCellNum">${i}</div>`;

    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'monthCellEvents';
    renderEventsPills(cellDateISO, eventsContainer);
    cell.appendChild(eventsContainer);

    cell.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cal-event-pill')) return;
      handleCellClick(cellDateISO);
    });
    grid.appendChild(cell);
  }

  monthView.appendChild(grid);
  elViewport.innerHTML = '';
  elViewport.appendChild(monthView);
}

function renderEventsPills(dISO: string, container: HTMLElement): void {
  const dayTasks = tasksForDate(dISO);
  const maxPills = 3;
  
  dayTasks.slice(0, maxPills).forEach(t => {
    const pill = document.createElement('div');
    const color = getCategoryColor(t.category);
    pill.className = 'cal-event-pill' + (t.done ? ' done' : '');
    
    if (t.type) {
      pill.classList.add(`is-${t.type}`);
    }

    pill.style.setProperty('--event-color', color);
    pill.style.setProperty('--event-bg', hexToRgba(color, 0.08));
    
    let text = '';
    if (t.type === 'birthday') {
      text = `🎂 ${t.title}`;
    } else if (t.type === 'reminder') {
      text = `🔔 ${t.time ? t.time + ' ' : ''}${t.title}`;
    } else if (t.type === 'event') {
      text = `🕒 ${t.time || ''}${t.endTime ? '-' + t.endTime : ''} ${t.title}`;
    } else {
      text = `${t.time ? t.time + ' ' : ''}${t.title}`;
    }
    
    pill.textContent = text;
    
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(t.id);
    });
    container.appendChild(pill);
  });

  if (dayTasks.length > maxPills) {
    const more = document.createElement('div');
    more.className = 'cal-event-pill';
    more.style.fontStyle = 'italic';
    more.style.color = 'var(--muted)';
    more.textContent = `+ ${dayTasks.length - maxPills} plus`;
    container.appendChild(more);
  }
}

// ---- 3. Week View Renderer ----
function renderWeekView(): void {
  const weekView = document.createElement('div');
  weekView.className = 'weekView';

  const start = startOfWeek(state.cursor);

  // Week header
  const weekHead = document.createElement('div');
  weekHead.className = 'weekViewHead';
  weekHead.innerHTML = '<div class="ruler-pad"></div>';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const dISO = iso(d);
    const isToday = dISO === todayISO();
    const dayTasks = tasksForDate(dISO);
    
    const colHead = document.createElement('div');
    colHead.className = 'weekViewHeadCol' + (isToday ? ' isToday' : '');
    colHead.innerHTML = `${DAYS_FR_SHORT[d.getDay()]}<span class="num">${d.getDate()}</span>`;
    
    // Render all-day entries in the header column
    const allDayTasks = dayTasks.filter(t => !t.time || t.type === 'birthday');
    if (allDayTasks.length > 0) {
      const allDayWrapper = document.createElement('div');
      allDayWrapper.className = 'week-all-day-wrapper';
      allDayTasks.forEach(t => {
        const item = document.createElement('div');
        const color = getCategoryColor(t.category);
        item.className = 'week-all-day-pill' + (t.done ? ' done' : '');
        item.style.setProperty('--event-color', color);
        item.style.setProperty('--event-bg', hexToRgba(color, 0.08));
        
        let prefix = '';
        if (t.type === 'birthday') prefix = '🎂 ';
        else if (t.type === 'reminder') prefix = '🔔 ';
        else if (t.type === 'event') prefix = '🕒 ';
        
        item.textContent = `${prefix}${t.title}`;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditModal(t.id);
        });
        allDayWrapper.appendChild(item);
      });
      colHead.appendChild(allDayWrapper);
    }

    weekHead.appendChild(colHead);
  }
  weekView.appendChild(weekHead);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'weekViewGrid';

  // Hour ruler
  const ruler = document.createElement('div');
  ruler.className = 'hourRuler';
  for (let h = 0; h < 24; h++) {
    const cell = document.createElement('div');
    cell.className = 'hourRulerCell';
    cell.textContent = String(h).padStart(2, '0') + ':00';
    ruler.appendChild(cell);
  }
  grid.appendChild(ruler);

  // Days Columns
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const dISO = iso(d);
    const isToday = dISO === todayISO();
    const dayTasks = tasksForDate(dISO);

    const dayCol = document.createElement('div');
    dayCol.className = 'dayColumn' + (isToday ? ' isToday' : '');
    
    // Grid cells (for visual lines)
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement('div');
      cell.className = 'dayColumnCell';
      cell.addEventListener('click', () => {
        const timeVal = String(h).padStart(2, '0') + ':00';
        openCreateModal(dISO, timeVal);
      });
      dayCol.appendChild(cell);
    }

    // Render positioned events (skip all-day events / birthdays without time)
    dayTasks.forEach(t => {
      if (!t.time || t.type === 'birthday') return;
      const [hStr, mStr] = t.time.split(':');
      const hours = parseInt(hStr) || 0;
      const mins = parseInt(mStr) || 0;
      
      const topOffset = (hours + mins / 60) * 60; // 60px per hour
      let height = 50; // default height for 1 hour approx
      if (t.type === 'event' && t.endTime) {
        const [ehStr, emStr] = t.endTime.split(':');
        const eh = parseInt(ehStr) || 0;
        const em = parseInt(emStr) || 0;
        const durationHours = (eh + em / 60) - (hours + mins / 60);
        if (durationHours > 0) {
          height = Math.max(30, durationHours * 60);
        }
      }

      const block = document.createElement('div');
      const color = getCategoryColor(t.category);
      block.className = 'timeline-event-block' + (t.done ? ' done' : '');
      
      if (t.type) {
        block.classList.add(`is-${t.type}`);
      }

      block.style.top = `${topOffset}px`;
      block.style.height = `${height}px`;
      block.style.setProperty('--event-color', color);
      block.style.setProperty('--event-bg', hexToRgba(color, 0.08));
      
      let prefix = '';
      if (t.type === 'reminder') prefix = '🔔 ';
      else if (t.type === 'event') prefix = '🕒 ';

      block.innerHTML = `
        <span class="evt-time">${t.time}${t.type === 'event' && t.endTime ? ' – ' + t.endTime : ''}</span>
        <span class="evt-title">${prefix}${escapeHtml(t.title)}</span>
      `;
      block.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(t.id);
      });
      dayCol.appendChild(block);
    });

    grid.appendChild(dayCol);
  }

  weekView.appendChild(grid);
  elViewport.innerHTML = '';
  elViewport.appendChild(weekView);
}

// ---- 4. Day View Renderer ----
function renderDayView(): void {
  const weekView = document.createElement('div');
  weekView.className = 'weekView';

  const d = state.cursor;
  const dISO = iso(d);
  const isToday = dISO === todayISO();
  const dayTasks = tasksForDate(dISO);

  // Header
  const weekHead = document.createElement('div');
  weekHead.className = 'weekViewHead';
  weekHead.style.gridTemplateColumns = '50px 1fr';
  weekHead.innerHTML = '<div class="ruler-pad"></div>';
  
  const colHead = document.createElement('div');
  colHead.className = 'weekViewHeadCol' + (isToday ? ' isToday' : '');
  colHead.innerHTML = `${DAYS_FR[d.getDay()]}<span class="num">${d.getDate()} ${MONTHS_FR[d.getMonth()]}</span>`;
  
  // Render all-day entries in the header column
  const allDayTasks = dayTasks.filter(t => !t.time || t.type === 'birthday');
  if (allDayTasks.length > 0) {
    const allDayWrapper = document.createElement('div');
    allDayWrapper.className = 'week-all-day-wrapper';
    allDayTasks.forEach(t => {
      const item = document.createElement('div');
      const color = getCategoryColor(t.category);
      item.className = 'week-all-day-pill' + (t.done ? ' done' : '');
      item.style.setProperty('--event-color', color);
      item.style.setProperty('--event-bg', hexToRgba(color, 0.08));
      
      let prefix = '';
      if (t.type === 'birthday') prefix = '🎂 ';
      else if (t.type === 'reminder') prefix = '🔔 ';
      else if (t.type === 'event') prefix = '🕒 ';
      
      item.textContent = `${prefix}${t.title}`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(t.id);
      });
      allDayWrapper.appendChild(item);
    });
    colHead.appendChild(allDayWrapper);
  }

  weekHead.appendChild(colHead);
  weekView.appendChild(weekHead);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'weekViewGrid';
  grid.style.gridTemplateColumns = '50px 1fr';

  // Hour ruler
  const ruler = document.createElement('div');
  ruler.className = 'hourRuler';
  for (let h = 0; h < 24; h++) {
    const cell = document.createElement('div');
    cell.className = 'hourRulerCell';
    cell.textContent = String(h).padStart(2, '0') + ':00';
    ruler.appendChild(cell);
  }
  grid.appendChild(ruler);

  // Day Column
  const dayCol = document.createElement('div');
  dayCol.className = 'dayColumn' + (isToday ? ' isToday' : '');
  
  for (let h = 0; h < 24; h++) {
    const cell = document.createElement('div');
    cell.className = 'dayColumnCell';
    cell.addEventListener('click', () => {
      const timeVal = String(h).padStart(2, '0') + ':00';
      openCreateModal(dISO, timeVal);
    });
    dayCol.appendChild(cell);
  }

  // Render positioned events (skip all-day events / birthdays without time)
  dayTasks.forEach(t => {
    if (!t.time || t.type === 'birthday') return;
    const [hStr, mStr] = t.time.split(':');
    const hours = parseInt(hStr) || 0;
    const mins = parseInt(mStr) || 0;
    
    const topOffset = (hours + mins / 60) * 60;
    let height = 50; // default height for 1 hour approx
    if (t.type === 'event' && t.endTime) {
      const [ehStr, emStr] = t.endTime.split(':');
      const eh = parseInt(ehStr) || 0;
      const em = parseInt(emStr) || 0;
      const durationHours = (eh + em / 60) - (hours + mins / 60);
      if (durationHours > 0) {
        height = Math.max(30, durationHours * 60);
      }
    }

    const block = document.createElement('div');
    const color = getCategoryColor(t.category);
    block.className = 'timeline-event-block' + (t.done ? ' done' : '');
    
    if (t.type) {
      block.classList.add(`is-${t.type}`);
    }

    block.style.top = `${topOffset}px`;
    block.style.height = `${height}px`;
    block.style.setProperty('--event-color', color);
    block.style.setProperty('--event-bg', hexToRgba(color, 0.08));
    
    let prefix = '';
    if (t.type === 'reminder') prefix = '🔔 ';
    else if (t.type === 'event') prefix = '🕒 ';

    block.innerHTML = `
      <span class="evt-time">${t.time}${t.type === 'event' && t.endTime ? ' – ' + t.endTime : ''}</span>
      <span class="evt-title">${prefix}${escapeHtml(t.title)}</span>
    `;
    block.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(t.id);
    });
    dayCol.appendChild(block);
  });

  grid.appendChild(dayCol);
  weekView.appendChild(grid);
  elViewport.innerHTML = '';
  elViewport.appendChild(weekView);
}

// ---- 4b. Today Signature View Renderer ----
function renderTodayLayoutView(): void {
  const container = document.createElement('div');
  container.className = 'today-layout-view';
  
  // Filter tasks for today's active date (state.cursor)
  const currentDateISO = iso(state.cursor);
  const todayTasks = tasks.filter(t => t.date === currentDateISO);
  
  // Sort tasks: undone first, then sorted by time, then title
  todayTasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    return a.title.localeCompare(b.title);
  });

  const doneCount = todayTasks.filter(t => t.done).length;
  const totalCount = todayTasks.length;

  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  const dateText = state.cursor.toLocaleDateString('fr-FR', opts);

  // Custom premium title micro-experience
  const todayISOStr = todayISO();
  let customTitle = "aujourd'hui";
  const yesterdayStr = iso(addDays(new Date(), -1));
  const tomorrowStr = iso(addDays(new Date(), 1));

  if (currentDateISO === yesterdayStr) {
    customTitle = "hier";
  } else if (currentDateISO === tomorrowStr) {
    customTitle = "demain";
  } else if (currentDateISO !== todayISOStr) {
    customTitle = DAYS_FR[state.cursor.getDay()];
  }

  container.innerHTML = `
    <div class="today-container">
      <div class="today-header">
        <span class="today-date-text">${dateText}</span>
        <div class="today-header-actions">
          <button class="today-note-btn" id="btnTodayNote" title="Note de ce jour">
            <i data-lucide="pencil" class="today-note-icon"></i>
            <span>Note</span>
          </button>
          <span class="today-progress">
            <span class="today-done-num">${doneCount}</span>
            <span> / </span>
            <span>${totalCount}</span>
            <span> done</span>
          </span>
        </div>
      </div>

      <h1 class="today-title">${customTitle}<span class="today-title-dot">.</span></h1>
      <div class="today-divider"></div>

      <ul class="today-task-list" id="today-task-list"></ul>

      <div class="today-all-done ${totalCount > 0 && doneCount === totalCount ? 'visible' : ''}">
        ✦ tout fait. repose-toi.
      </div>

      <div class="today-add-section">
        <div class="today-add-form">
          <span class="today-add-prefix">›</span>
          <input
            type="text"
            class="today-add-input"
            id="today-add-input"
            placeholder="ajouter une tâche..."
            autocomplete="off"
            spellcheck="false"
          >
          <span class="today-add-hint">↵ enter</span>
        </div>
      </div>
    </div>
  `;

  const listEl = container.querySelector('#today-task-list') as HTMLUListElement;
  todayTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'today-task-item' + (task.done ? ' done' : '');
    
    if (task.type) {
      li.classList.add(`is-${task.type}`);
    }
    
    // Formatting subtext (time + category + details)
    let subParts: string[] = [];
    if (task.type === 'event' && task.time) {
      subParts.push(`${task.time}${task.endTime ? ' – ' + task.endTime : ''}`);
    } else if (task.time) {
      subParts.push(task.time);
    }
    if (task.category) subParts.push(task.category);
    if (task.detail) subParts.push(task.detail);
    const subText = subParts.join(' · ');

    let ledHtml = `<div class="today-led"></div>`;
    let isClickable = true;
    
    if (task.type === 'birthday') {
      ledHtml = `<div class="today-type-icon" title="Anniversaire"><i data-lucide="cake"></i></div>`;
      isClickable = false;
    } else if (task.type === 'event') {
      ledHtml = `<div class="today-type-icon" title="Événement"><i data-lucide="clock"></i></div>`;
      isClickable = false;
    } else if (task.type === 'reminder') {
      ledHtml = `<div class="today-led is-reminder" title="Rappel" style="display: flex; align-items: center; justify-content: center;"><i data-lucide="bell" style="width: 8px; height: 8px; color: var(--accent);"></i></div>`;
    }

    li.innerHTML = `
      ${ledHtml}
      <div class="today-task-content">
        <div class="today-task-label">${escapeHtml(task.title)}</div>
        ${subText ? `<div class="today-task-sub">${escapeHtml(subText)}</div>` : ''}
      </div>
      <button class="today-task-delete" data-id="${task.id}" title="supprimer">×</button>
    `;

    // Clicks on the list item toggles checkbox or opens edit modal
    li.addEventListener('click', e => {
      if ((e.target as HTMLElement).classList.contains('today-task-delete')) return;
      if (!isClickable) {
        openEditModal(task.id);
        return;
      }
      task.done = !task.done;
      saveTasks(tasks);
      render();
    });

    li.querySelector('.today-task-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks(tasks);
      render();
    });

    listEl.appendChild(li);
  });

  const inp = container.querySelector('#today-add-input') as HTMLInputElement;
  inp?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = inp.value.trim();
      if (!val) return;
      
      let category = 'Travail';
      if (state.activeList === 'Professionnel') category = 'Travail';
      else if (state.activeList === 'Personnel') category = 'Perso';

      tasks.push({
        id: genId(),
        title: val,
        detail: '',
        date: currentDateISO,
        time: '',
        done: false,
        priority: 'medium',
        category,
        list: state.activeList
      });
      saveTasks(tasks);
      render();
    }
  });

  container.querySelector('#btnTodayNote')?.addEventListener('click', async () => {
    const dailyNote = await notesManager.getOrCreateDailyNote(currentDateISO);
    state.view = 'notes';
    state.selectedNoteId = dailyNote.id;
    render();
  });

  elViewport.innerHTML = '';
  elViewport.appendChild(container);
}

// ---- 4c. Notes Workspace Renderer ----
let activeMDE: EasyMDE | null = null;

async function renderNotesView(): Promise<void> {
  // Clean up existing EasyMDE instance
  if (activeMDE) {
    activeMDE.toTextArea();
    activeMDE = null;
  }

  const notes = await notesManager.listNotes();
  
  const container = document.createElement('div');
  container.className = 'notes-workspace-container';

  container.innerHTML = `
    <div class="notes-sidebar">
      <div class="notes-sidebar-header">
        <input type="text" class="notes-search-input" placeholder="Rechercher des notes..." id="notesSearchInp">
        <button class="notes-new-btn" id="btnNewNote" title="Nouvelle note">
          <i data-lucide="plus"></i>
        </button>
      </div>
      <div class="notes-list" id="notesListContainer"></div>
    </div>
    <div class="notes-editor-pane" id="notesEditorPane">
      <div class="notes-placeholder">
        Sélectionnez ou créez une note pour commencer.
      </div>
    </div>
  `;

  elViewport.innerHTML = '';
  elViewport.appendChild(container);

  // Render left sidebar list
  const listContainer = container.querySelector('#notesListContainer') as HTMLElement;
  const searchInp = container.querySelector('#notesSearchInp') as HTMLInputElement;

  function drawNotesList(filterText: string = ''): void {
    try {
      listContainer.innerHTML = '';
      const filtered = notes.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(filterText.toLowerCase());
        const contentMatch = (n.content || '').toLowerCase().includes(filterText.toLowerCase());
        return titleMatch || contentMatch;
      });

      filtered.forEach(note => {
        const item = document.createElement('div');
        item.className = 'note-list-item' + (state.selectedNoteId === note.id ? ' active' : '');
        
        const isDaily = note.associatedDate ? true : false;
        const icon = isDaily ? 'calendar' : 'tag';

        item.innerHTML = `
          <i data-lucide="${icon}" class="note-icon"></i>
          <span class="note-item-title">${escapeHtml(note.title || 'Sans titre')}</span>
          <button class="note-item-delete" title="Supprimer la note"><i data-lucide="x"></i></button>
        `;

        item.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.note-item-delete')) return;
          selectNote(note.id);
        });

        item.querySelector('.note-item-delete')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await notesManager.deleteNote(note.id);
            if (state.selectedNoteId === note.id) {
              state.selectedNoteId = null;
            }
            render();
          } catch (err) {
            console.error('Failed to delete note:', err);
          }
        });

        listContainer.appendChild(item);
      });
      
      createIcons({
        icons: ALL_ICONS
      });
    } catch (err) {
      console.error('Error drawing notes list:', err);
    }
  }

  // Initial list draw
  drawNotesList();

  // Search input listener
  searchInp.addEventListener('input', () => {
    drawNotesList(searchInp.value);
  });

  // New Note button listener
  const btnNewNoteEl = container.querySelector('#btnNewNote');
  if (btnNewNoteEl) {
    btnNewNoteEl.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const newNote: AgendaNote = {
          id: genId(),
          title: 'Sans titre',
          content: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          linkedTaskIds: []
        };
        await notesManager.saveNote(newNote);
        state.selectedNoteId = newNote.id;
        render();
      } catch (err) {
        console.error('Error creating new note:', err);
      }
    });
  }

  // Select and show active note
  const activeNote = notes.find(n => n.id === state.selectedNoteId);
  if (activeNote) {
    const editorPane = container.querySelector('#notesEditorPane') as HTMLElement;
    editorPane.innerHTML = `
      <div class="notes-editor-header">
        <input type="text" class="notes-title-input" id="noteTitleInput" value="${escapeHtml(activeNote.title || '')}" placeholder="Titre de la note" maxlength="40">
        <span class="note-save-status" id="noteSaveStatus">enregistré</span>
      </div>
      <div class="notes-editor-textarea-wrapper">
        <textarea id="note-mde-textarea"></textarea>
      </div>
    `;

    // Title edit listener
    const titleInp = editorPane.querySelector('#noteTitleInput') as HTMLInputElement;
    titleInp.addEventListener('input', async () => {
      try {
        const newTitle = titleInp.value.trim() || 'Sans titre';
        activeNote.title = newTitle;
        
        const statusEl = editorPane.querySelector('#noteSaveStatus') as HTMLElement;
        statusEl.textContent = 'enregistrement...';
        
        await notesManager.saveNote(activeNote);
        
        // Update sidebar title in DOM directly to keep input focus
        const activeItem = listContainer.querySelector('.note-list-item.active .note-item-title');
        if (activeItem) {
          activeItem.textContent = newTitle;
        }
        statusEl.textContent = 'enregistré';
      } catch (err) {
        console.error('Error saving note title:', err);
      }
    });

    // Initialize EasyMDE with markdown-it renderer
    const md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });

    try {
      activeMDE = new EasyMDE({
        element: editorPane.querySelector('#note-mde-textarea') as HTMLTextAreaElement,
        initialValue: activeNote.content || '',
        placeholder: 'Commencez à écrire en Markdown...',
        spellChecker: false,
        autoDownloadFontAwesome: false,
        status: false,
        toolbar: [
          'bold', 'italic', 'heading', '|',
          'quote', 'unordered-list', 'ordered-list', '|',
          'link', 'image', '|',
          'preview', 'side-by-side', 'fullscreen'
        ],
        previewRender: (plainText) => {
          return DOMPurify.sanitize(md.render(plainText));
        }
      });

      // Map EasyMDE toolbar buttons to Lucide icons
      const toolbarEl = editorPane.querySelector('.editor-toolbar');
      if (toolbarEl) {
        const buttons = toolbarEl.querySelectorAll('button, a');
        buttons.forEach(btn => {
          const button = btn as HTMLElement;
          let iconName = '';
          if (button.classList.contains('bold')) iconName = 'bold';
          else if (button.classList.contains('italic')) iconName = 'italic';
          else if (button.classList.contains('heading')) iconName = 'heading';
          else if (button.classList.contains('quote')) iconName = 'quote';
          else if (button.classList.contains('unordered-list')) iconName = 'list';
          else if (button.classList.contains('ordered-list')) iconName = 'list-ordered';
          else if (button.classList.contains('link')) iconName = 'link';
          else if (button.classList.contains('image')) iconName = 'image';
          else if (button.classList.contains('preview')) iconName = 'eye';
          else if (button.classList.contains('side-by-side')) iconName = 'columns';
          else if (button.classList.contains('fullscreen')) iconName = 'maximize';
          
          if (iconName) {
            // Remove FontAwesome classes
            button.className = button.className.replace(/\bfa\b/g, '').replace(/\bfa-\S+/g, '');
            button.innerHTML = `<i data-lucide="${iconName}"></i>`;
          }
        });
        createIcons({
          icons: ALL_ICONS
        });
      }

      activeMDE.codemirror.on('change', async () => {
        try {
          const statusEl = editorPane.querySelector('#noteSaveStatus') as HTMLElement;
          statusEl.textContent = 'enregistrement...';
          activeNote.content = activeMDE!.value();
          await notesManager.saveNote(activeNote);
          statusEl.textContent = 'enregistré';
        } catch (err) {
          console.error('Error auto-saving note content:', err);
        }
      });
    } catch (err) {
      console.error('Error initializing EasyMDE:', err);
    }
  }
}

function selectNote(noteId: string): void {
  state.selectedNoteId = noteId;
  render();
}

// ---- 5. Tasks Sidebar Renderer ----
function deleteList(lName: string): void {
  const index = lists.indexOf(lName);
  if (index > 0) {
    lists.splice(index, 1);
    saveLists(lists);
    
    const defaultList = lists[0] || 'Ma liste';
    tasks.forEach(t => {
      if (t.list === lName) {
        t.list = defaultList;
      }
    });
    saveTasks(tasks);

    if (state.activeList === lName) {
      state.activeList = defaultList;
    }
    render();
  }
}

function renameList(oldName: string, newName: string): void {
  if (!newName || oldName === newName) {
    state.renamingListName = null;
    render();
    return;
  }
  // Check duplicates
  if (lists.includes(newName)) {
    state.renamingListName = null;
    render();
    return;
  }

  // Update tasks list
  tasks.forEach(t => {
    if (t.list === oldName) {
      t.list = newName;
    }
  });
  saveTasks(tasks);

  // Update lists array
  const idx = lists.indexOf(oldName);
  if (idx >= 0) {
    lists[idx] = newName;
    saveLists(lists);
  }

  if (state.activeList === oldName) {
    state.activeList = newName;
  }

  state.renamingListName = null;
  render();
}

function renderTasksSidebar(): void {
  // Populate current list name
  const curNameEl = document.getElementById('currentListName');
  if (curNameEl) {
    curNameEl.textContent = state.activeList;
  }

  // Populate custom dropdown menu items
  const menuItemsEl = document.getElementById('listMenuItems');
  if (menuItemsEl) {
    menuItemsEl.innerHTML = '';
    lists.forEach(lName => {
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'menu-item-wrapper' + (state.activeList === lName ? ' active' : '');
      
      if (lName === state.renamingListName) {
        itemWrapper.innerHTML = `
          <div class="list-rename-container">
            <input type="text" class="list-rename-input" value="${escapeHtml(lName)}" maxlength="20">
            <button class="inline-btn save btn-save-list-rename" title="Enregistrer"><i data-lucide="check"></i></button>
            <button class="inline-btn cancel btn-cancel-list-rename" title="Annuler"><i data-lucide="x"></i></button>
          </div>
        `;
        
        const renameInput = itemWrapper.querySelector('.list-rename-input') as HTMLInputElement;
        setTimeout(() => {
          renameInput?.focus();
          renameInput?.select();
        }, 0);

        renameInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            renameList(lName, renameInput.value.trim());
          } else if (e.key === 'Escape') {
            state.renamingListName = null;
            render();
          }
        });
        
        itemWrapper.querySelector('.btn-save-list-rename')?.addEventListener('click', (e) => {
          e.stopPropagation();
          renameList(lName, renameInput.value.trim());
        });
        
        itemWrapper.querySelector('.btn-cancel-list-rename')?.addEventListener('click', (e) => {
          e.stopPropagation();
          state.renamingListName = null;
          render();
        });
      } else {
        const itemBtn = document.createElement('button');
        itemBtn.className = 'menu-item-btn';
        itemBtn.textContent = lName;
        itemBtn.addEventListener('click', () => {
          state.activeList = lName;
          const menu = document.getElementById('listDropdownMenu');
          if (menu) menu.style.display = 'none';
          render();
          syncDatabase();
        });
        itemWrapper.appendChild(itemBtn);

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'list-rename-btn';
        editBtn.innerHTML = '<i data-lucide="pencil"></i>';
        editBtn.title = 'Renommer la liste';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.renamingListName = lName;
          render();
        });
        itemWrapper.appendChild(editBtn);

        // Don't allow deleting the first default list
        if (lists.indexOf(lName) > 0) {
          const delBtn = document.createElement('button');
          delBtn.className = 'list-delete-btn';
          delBtn.innerHTML = '<i data-lucide="x"></i>';
          delBtn.title = 'Supprimer la liste';
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteList(lName);
          });
          itemWrapper.appendChild(delBtn);
        }
      }

      menuItemsEl.appendChild(itemWrapper);
    });
  }

  // Filter sidebar tasks by active list and type (only tasks)
  const sidebarTasks = tasks.filter(t => (t.list || 'Ma liste') === state.activeList && (!t.type || t.type === 'task'));

  const active = sidebarTasks.filter(t => !t.done);
  const completed = sidebarTasks.filter(t => t.done);

  // Render active tasks
  elActiveTasksList.innerHTML = '';
  active.forEach(t => {
    elActiveTasksList.appendChild(createSidebarTaskRow(t));
  });

  // Render completed tasks
  elCompletedTasksList.innerHTML = '';
  completed.forEach(t => {
    elCompletedTasksList.appendChild(createSidebarTaskRow(t));
  });

  elCompletedCount.textContent = String(completed.length);
}

function createSidebarTaskRow(t: Task): HTMLElement {
  const li = document.createElement('li');
  li.className = 'task-item-row' + (t.done ? ' done' : '');
  
  const categoryColor = getCategoryColor(t.category);
  const categoryBadge = t.category 
    ? `<span class="task-item-category-badge" style="--badge-color: ${categoryColor}; border-color: ${hexToRgba(categoryColor, 0.3)}">${escapeHtml(t.category)}</span>` 
    : '';

  li.innerHTML = `
    <div class="checkbox ${t.done ? 'done' : ''}" data-id="${t.id}">
      <i data-lucide="check"></i>
    </div>
    <div class="task-item-body" data-id="${t.id}">
      <div class="task-item-title">${escapeHtml(t.title)}</div>
      ${t.detail ? `<div class="task-item-detail">${escapeHtml(t.detail)}</div>` : ''}
      <div class="task-item-meta">
        <span class="task-item-date-badge">
          <i data-lucide="calendar"></i>
          <span>${t.date} ${t.time ? '@ ' + t.time : ''}</span>
        </span>
        ${categoryBadge}
      </div>
    </div>
    <button class="task-item-del" data-id="${t.id}" title="supprimer">
      <i data-lucide="trash-2"></i>
    </button>
  `;

  li.querySelector('.checkbox')?.addEventListener('click', () => toggleDone(t.id));
  li.querySelector('.task-item-body')?.addEventListener('click', () => openEditModal(t.id));
  li.querySelector('.task-item-del')?.addEventListener('click', () => deleteTask(t.id));

  return li;
}

// ---- 6. Modal Create / Edit Handlers ----
function populateModalLists(selectedVal: string = ''): void {
  const listSelect = document.getElementById('modalInpList') as HTMLSelectElement;
  if (!listSelect) return;
  listSelect.innerHTML = '';
  lists.forEach(lName => {
    const opt = document.createElement('option');
    opt.value = lName;
    opt.textContent = lName;
    opt.selected = lName === selectedVal;
    listSelect.appendChild(opt);
  });
}

function populateModalCategories(selectedVal: string = ''): void {
  const catSelect = document.getElementById('modalInpCategory') as HTMLSelectElement;
  if (!catSelect) return;
  catSelect.innerHTML = '';
  calendars.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal.name;
    opt.textContent = cal.name;
    opt.selected = cal.name === selectedVal;
    catSelect.appendChild(opt);
  });
}

let modalActiveType: 'task' | 'event' | 'birthday' | 'reminder' = 'task';

function setModalType(type: 'task' | 'event' | 'birthday' | 'reminder'): void {
  modalActiveType = type;
  
  // Update tab buttons active state
  document.querySelectorAll('.modal-type-switcher .modal-type-btn').forEach(btn => {
    const button = btn as HTMLButtonElement;
    button.classList.toggle('active', button.dataset.type === type);
  });

  // Show/hide fields
  const detail = document.getElementById('groupModalDetail') as HTMLElement;
  const timeTask = document.getElementById('groupModalTimeTask') as HTMLElement;
  const timeEvent = document.getElementById('groupModalTimeEvent') as HTMLElement;
  const timeReminder = document.getElementById('groupModalTimeReminder') as HTMLElement;
  const list = document.getElementById('groupModalList') as HTMLElement;
  const priority = document.getElementById('groupModalPriority') as HTMLElement;

  if (detail) detail.style.display = (type === 'birthday') ? 'none' : '';
  
  if (timeTask) timeTask.style.display = (type === 'task') ? '' : 'none';
  if (timeEvent) timeEvent.style.display = (type === 'event') ? '' : 'none';
  if (timeReminder) timeReminder.style.display = (type === 'reminder') ? '' : 'none';
  
  if (list) list.style.display = (type === 'task') ? '' : 'none';
  if (priority) priority.style.display = (type === 'task') ? '' : 'none';
  
  // Adjust layout grid columns of row 4
  const row4 = document.getElementById('groupModalRow4') as HTMLElement;
  if (row4) {
    if (type === 'task') {
      row4.className = 'modal-form-row three-cols';
    } else {
      row4.className = 'modal-form-row'; // Default 1 col
    }
  }
}

function openCreateModal(dateISO: string, timeVal: string = ''): void {
  state.editingTaskId = null;
  
  const modalTitle = document.getElementById('modalTitle') as HTMLElement;
  const btnDelete = document.getElementById('btnModalDelete') as HTMLElement;
  
  modalTitle.textContent = 'Créer une entrée';
  btnDelete.style.display = 'none';

  setModalType('task');

  (document.getElementById('modalInpTitle') as HTMLInputElement).value = '';
  (document.getElementById('modalInpDetail') as HTMLTextAreaElement).value = '';
  (document.getElementById('modalInpDate') as HTMLInputElement).value = dateISO;
  (document.getElementById('modalInpTimeTask') as HTMLInputElement).value = timeVal;
  (document.getElementById('modalInpTimeStart') as HTMLInputElement).value = timeVal;
  (document.getElementById('modalInpTimeEnd') as HTMLInputElement).value = '';
  (document.getElementById('modalInpTimeReminder') as HTMLInputElement).value = timeVal || '09:00';
  
  // Set default category according to active list
  let defaultCategory = calendars[0] ? calendars[0].name : 'Travail';
  if (state.activeList === 'Professionnel' && calendars.some(c => c.name === 'Travail')) {
    defaultCategory = 'Travail';
  } else if (state.activeList === 'Personnel' && calendars.some(c => c.name === 'Perso')) {
    defaultCategory = 'Perso';
  }

  populateModalLists(state.activeList);
  populateModalCategories(defaultCategory);
  resetModalPriority();

  elModal.style.display = 'flex';
}

function openEditModal(id: string): void {
  const t = tasks.find(item => item.id === id);
  if (!t) return;

  state.editingTaskId = id;
  const type = t.type || 'task';
  setModalType(type);

  const modalTitle = document.getElementById('modalTitle') as HTMLElement;
  const btnDelete = document.getElementById('btnModalDelete') as HTMLElement;
  
  modalTitle.textContent = (type === 'task') ? 'Modifier la tâche' :
                           (type === 'event') ? 'Modifier l\'événement' :
                           (type === 'birthday') ? 'Modifier l\'anniversaire' :
                           'Modifier le rappel';
  btnDelete.style.display = 'flex';

  (document.getElementById('modalInpTitle') as HTMLInputElement).value = t.title;
  (document.getElementById('modalInpDetail') as HTMLTextAreaElement).value = t.detail;
  (document.getElementById('modalInpDate') as HTMLInputElement).value = t.date;
  
  if (type === 'task') {
    (document.getElementById('modalInpTimeTask') as HTMLInputElement).value = t.time || '';
  } else if (type === 'event') {
    (document.getElementById('modalInpTimeStart') as HTMLInputElement).value = t.time || '';
    (document.getElementById('modalInpTimeEnd') as HTMLInputElement).value = t.endTime || '';
  } else if (type === 'reminder') {
    (document.getElementById('modalInpTimeReminder') as HTMLInputElement).value = t.time || '09:00';
  }

  populateModalLists(t.list || 'Ma liste');
  populateModalCategories(t.category || (calendars[0] ? calendars[0].name : 'Travail'));
  setModalPriority(t.priority || 'medium');

  elModal.style.display = 'flex';
  
  createIcons({
    icons: ALL_ICONS
  });
}

function closeModal(): void {
  elModal.style.display = 'none';
}

function saveModalTask(): void {
  const title = (document.getElementById('modalInpTitle') as HTMLInputElement).value.trim();
  if (!title) return;

  const detail = (document.getElementById('modalInpDetail') as HTMLTextAreaElement).value.trim();
  const date = (document.getElementById('modalInpDate') as HTMLInputElement).value || todayISO();
  const category = (document.getElementById('modalInpCategory') as HTMLSelectElement).value;
  
  let time = '';
  let endTime = '';
  let list = 'Ma liste';
  let priority: 'low' | 'medium' | 'high' = 'medium';

  if (modalActiveType === 'task') {
    time = (document.getElementById('modalInpTimeTask') as HTMLInputElement).value || '';
    list = (document.getElementById('modalInpList') as HTMLSelectElement).value;
    priority = modalPriority;
  } else if (modalActiveType === 'event') {
    time = (document.getElementById('modalInpTimeStart') as HTMLInputElement).value || '';
    endTime = (document.getElementById('modalInpTimeEnd') as HTMLInputElement).value || '';
  } else if (modalActiveType === 'reminder') {
    time = (document.getElementById('modalInpTimeReminder') as HTMLInputElement).value || '09:00';
  }

  if (state.editingTaskId) {
    const t = tasks.find(item => item.id === state.editingTaskId);
    if (t) {
      t.type = modalActiveType;
      t.title = title;
      t.detail = detail;
      t.date = date;
      t.time = time;
      t.endTime = endTime;
      t.category = category;
      t.priority = priority;
      t.list = list;
    }
  } else {
    tasks.push({
      id: genId(),
      type: modalActiveType,
      title,
      detail,
      date,
      time,
      endTime,
      done: false,
      priority,
      category,
      list
    });
  }

  saveTasks(tasks);
  closeModal();
  render();
}

function deleteModalTask(): void {
  if (state.editingTaskId) {
    deleteTask(state.editingTaskId);
    closeModal();
  }
}

function resetModalPriority(): void {
  setModalPriority('medium');
}

function setModalPriority(p: 'low' | 'medium' | 'high'): void {
  modalPriority = p;
  document.querySelectorAll('.prio-select-pills .modal-prio-pill').forEach(btn => {
    const button = btn as HTMLButtonElement;
    button.classList.toggle('active', button.dataset.priority === p);
  });
}

// ---- Helpers ----
function getCategoryColor(cat: string): string {
  const found = calendars.find(c => c.name === cat);
  return found ? found.color : '#e0a458';
}

function hexToRgba(hex: string, alpha: number): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] || c));
}

// ---- 7. Global Listeners & Events ----
// Calendar View Navigation Switcher
document.querySelectorAll('.view-switch-group .view-btn').forEach(btn => {
  const button = btn as HTMLButtonElement;
  button.addEventListener('click', () => {
    if (button.dataset.view) {
      state.view = button.dataset.view as 'month' | 'week' | 'day' | 'today' | 'notes';
      render();
      syncDatabase();
    }
  });
});

// Navigation Arrows (prev/next)
function changeMonthSafely(d: Date, diff: number): void {
  const currentDate = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + diff);
  const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(currentDate, maxDays));
}

document.getElementById('btnPrev')?.addEventListener('click', () => {
  if (state.view === 'month') {
    changeMonthSafely(state.cursor, -1);
  } else if (state.view === 'week') {
    state.cursor = addDays(state.cursor, -7);
  } else if (state.view === 'day' || state.view === 'today') {
    state.cursor = addDays(state.cursor, -1);
  }
  render();
});

document.getElementById('btnNext')?.addEventListener('click', () => {
  if (state.view === 'month') {
    changeMonthSafely(state.cursor, 1);
  } else if (state.view === 'week') {
    state.cursor = addDays(state.cursor, 7);
  } else if (state.view === 'day' || state.view === 'today') {
    state.cursor = addDays(state.cursor, 1);
  }
  render();
});

// Mini Calendar arrows
document.getElementById('miniPrevBtn')?.addEventListener('click', () => {
  changeMonthSafely(state.cursor, -1);
  render();
});
document.getElementById('miniNextBtn')?.addEventListener('click', () => {
  changeMonthSafely(state.cursor, 1);
  render();
});

document.getElementById('btnToday')?.addEventListener('click', () => {
  state.cursor = new Date();
  state.selectedDate = todayISO();
  render();
});

// Floating create button
document.getElementById('btnOpenCreateModal')?.addEventListener('click', () => {
  openCreateModal(state.selectedDate);
});

// Modal Actions
document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);
document.getElementById('btnModalCancel')?.addEventListener('click', closeModal);
document.getElementById('btnModalSave')?.addEventListener('click', saveModalTask);
document.getElementById('btnModalDelete')?.addEventListener('click', deleteModalTask);

// Modal Priority Select Pills
document.querySelectorAll('.prio-select-pills .modal-prio-pill').forEach(btn => {
  const button = btn as HTMLButtonElement;
  button.addEventListener('click', () => {
    if (button.dataset.priority) {
      setModalPriority(button.dataset.priority as 'low' | 'medium' | 'high');
    }
  });
});

// Modal Type Switcher Tabs
document.querySelectorAll('.modal-type-switcher .modal-type-btn').forEach(btn => {
  const button = btn as HTMLButtonElement;
  button.addEventListener('click', () => {
    if (button.dataset.type) {
      setModalType(button.dataset.type as any);
    }
  });
});

// ---- 8. Tasks Sidebar: Custom Dropdown List Selector ----
const dropdownTrigger = document.getElementById('listDropdownTrigger');
const dropdownMenu = document.getElementById('listDropdownMenu');

dropdownTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (dropdownMenu) {
    const isShowing = dropdownMenu.style.display === 'flex' || dropdownMenu.style.display === 'block';
    dropdownMenu.style.display = isShowing ? 'none' : 'flex';
  }
});

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  if (dropdownMenu && !dropdownMenu.contains(e.target as Node) && e.target !== dropdownTrigger) {
    dropdownMenu.style.display = 'none';
  }
});

// Show inline new list creation form
const btnCreateList = document.getElementById('btnCreateList');
const newListInputContainer = document.getElementById('newListInputContainer');
const inpNewListName = document.getElementById('inpNewListName') as HTMLInputElement;

btnCreateList?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (btnCreateList && newListInputContainer) {
    btnCreateList.style.display = 'none';
    newListInputContainer.style.display = 'flex';
    inpNewListName.focus();
  }
});

// Cancel new list creation
const btnCancelNewList = document.getElementById('btnCancelNewList');
function cancelNewListCreation(): void {
  if (btnCreateList && newListInputContainer) {
    newListInputContainer.style.display = 'none';
    btnCreateList.style.display = 'flex';
    inpNewListName.value = '';
  }
}
btnCancelNewList?.addEventListener('click', (e) => {
  e.stopPropagation();
  cancelNewListCreation();
});

// Save new list
const btnSaveNewList = document.getElementById('btnSaveNewList');
function saveNewList(): void {
  const name = inpNewListName.value.trim();
  if (!name) {
    cancelNewListCreation();
    return;
  }

  // Check duplicate
  if (!lists.includes(name)) {
    lists.push(name);
    saveLists(lists);
    state.activeList = name;
  }

  cancelNewListCreation();
  if (dropdownMenu) dropdownMenu.style.display = 'none';
  render();
}

btnSaveNewList?.addEventListener('click', (e) => {
  e.stopPropagation();
  saveNewList();
});

inpNewListName?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveNewList();
  } else if (e.key === 'Escape') {
    cancelNewListCreation();
  }
});

// Tasks Sidebar: Quick Add Task Input
const quickInput = document.getElementById('quickAddTaskInput') as HTMLInputElement;
if (quickInput) {
  quickInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const title = quickInput.value.trim();
      if (!title) return;
      
      let category = 'Travail';
      if (state.activeList === 'Professionnel') category = 'Travail';
      else if (state.activeList === 'Personnel') category = 'Perso';

      tasks.push({
        id: genId(),
        title,
        detail: '',
        date: state.selectedDate,
        time: '',
        done: false,
        priority: 'medium',
        category,
        list: state.activeList
      });
      saveTasks(tasks);
      quickInput.value = '';
      render();
    }
  });
}

// Tasks Sidebar: Completed Tasks Collapsible Panel toggle
document.getElementById('btnToggleCompleted')?.addEventListener('click', () => {
  const panel = document.getElementById('completedTasksList') as HTMLElement;
  const toggle = document.getElementById('btnToggleCompleted') as HTMLElement;
  if (!panel || !toggle) return;

  state.completedTasksOpen = !state.completedTasksOpen;
  panel.style.display = state.completedTasksOpen ? 'block' : 'none';
  toggle.classList.toggle('open', state.completedTasksOpen);
});

// Theme Switcher Logic
function applyTheme(themeName: string): void {
  document.body.className = '';
  document.body.classList.add(`theme-${themeName}`);
  activeTheme = themeName;
  
  const select = document.getElementById('themeSelector') as HTMLSelectElement;
  if (select) {
    select.value = themeName;
  }
}

const themeSel = document.getElementById('themeSelector') as HTMLSelectElement;
if (themeSel) {
  themeSel.addEventListener('change', () => {
    applyTheme(themeSel.value);
    syncDatabase();
  });
}

// ---- 9. Custom Agendas: Inline creator Form Listeners ----
const btnOpenNewCalendar = document.getElementById('btnOpenNewCalendar');
const newCalendarInputContainer = document.getElementById('newCalendarInputContainer');
const inpNewCalName = document.getElementById('inpNewCalName') as HTMLInputElement;
const inpNewCalColor = document.getElementById('inpNewCalColor') as HTMLInputElement;

btnOpenNewCalendar?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (btnOpenNewCalendar && newCalendarInputContainer) {
    btnOpenNewCalendar.style.display = 'none';
    newCalendarInputContainer.style.display = 'flex';
    inpNewCalName.focus();
  }
});

// Cancel new calendar creation
const btnCancelNewCalendar = document.getElementById('btnCancelNewCalendar');
function cancelNewCalendarCreation(): void {
  if (btnOpenNewCalendar && newCalendarInputContainer) {
    newCalendarInputContainer.style.display = 'none';
    btnOpenNewCalendar.style.display = 'flex';
    inpNewCalName.value = '';
    inpNewCalColor.value = '#e0a458';
  }
}

btnCancelNewCalendar?.addEventListener('click', (e) => {
  e.stopPropagation();
  cancelNewCalendarCreation();
});

// Save new calendar
const btnSaveNewCalendar = document.getElementById('btnSaveNewCalendar');
function saveNewCalendar(): void {
  const name = inpNewCalName.value.trim();
  const color = inpNewCalColor.value;
  if (!name) {
    cancelNewCalendarCreation();
    return;
  }

  // Check duplicate
  const exists = calendars.some(c => c.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    calendars.push({
      name,
      color,
      checked: true
    });
    saveCalendars(calendars);
  }

  cancelNewCalendarCreation();
  render();
}

btnSaveNewCalendar?.addEventListener('click', (e) => {
  e.stopPropagation();
  saveNewCalendar();
});

inpNewCalName?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveNewCalendar();
  } else if (e.key === 'Escape') {
    cancelNewCalendarCreation();
  }
});

// Sidebar Collapsing Logic
document.getElementById('btnToggleLeftSidebar')?.addEventListener('click', () => {
  state.leftSidebarCollapsed = !state.leftSidebarCollapsed;
  const container = document.querySelector('.app-container');
  container?.classList.toggle('left-collapsed', state.leftSidebarCollapsed);
  syncDatabase();
});

document.getElementById('btnToggleRightSidebar')?.addEventListener('click', () => {
  state.rightSidebarCollapsed = !state.rightSidebarCollapsed;
  const container = document.querySelector('.app-container');
  container?.classList.toggle('right-collapsed', state.rightSidebarCollapsed);
  syncDatabase();
});

// Async initialization on startup
async function initApp(): Promise<void> {
  try {
    const dbData = await (window as any).electronAPI.loadData();
    if (dbData) {
      if (dbData.tasks) {
        // Normalize tasks
        tasks = dbData.tasks.map((t: any) => ({
          ...t,
          type: t.type || 'task',
          endTime: t.endTime || ''
        }));
      }
      if (dbData.calendars) calendars = dbData.calendars;
      if (dbData.lists) lists = dbData.lists;
      if (dbData.theme) activeTheme = dbData.theme;
      if (dbData.activeList) state.activeList = dbData.activeList;
      if (dbData.view) state.view = dbData.view;
      if (dbData.leftSidebarCollapsed !== undefined) state.leftSidebarCollapsed = dbData.leftSidebarCollapsed;
      if (dbData.rightSidebarCollapsed !== undefined) state.rightSidebarCollapsed = dbData.rightSidebarCollapsed;
    } else {
      // First run: save default database payload
      await syncDatabase();
    }
  } catch (e) {
    console.error('Failed to load database at startup', e);
  }

  // Apply sidebar states
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    appContainer.classList.toggle('left-collapsed', state.leftSidebarCollapsed);
    appContainer.classList.toggle('right-collapsed', state.rightSidebarCollapsed);
  }

  // Load theme and render UI
  applyTheme(activeTheme);
  render();
}

initApp();
