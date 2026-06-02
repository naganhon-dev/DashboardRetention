import React, { useMemo, useState } from 'react';
import { StudentSnapshot, Flow, AIMetrics, Interaction, InteractionType, ResultStatus, SystemStatus } from '../types';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { cn } from '../lib/utils';
import { CheckCircle2, X, Phone, ClipboardList, AlertTriangle, Play, HelpCircle, Archive, Award, RefreshCw, BarChart2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getExpectedUnitForFlow, getLatestSnapshots, calculateDashboardMetrics } from '../lib/logic';

interface DashboardProps {
  snapshots: StudentSnapshot[];
  flows: Flow[];
  selectedFilter: string;
  aiMetrics?: AIMetrics | null;
  updateSnapshots: (snapshots: StudentSnapshot[]) => void;
  addInteraction?: (interaction: Interaction, updatedSnapshot?: StudentSnapshot) => void;
  interactions?: Interaction[];
}

export function Dashboard({ 
  snapshots, 
  flows, 
  selectedFilter, 
  updateSnapshots, 
  addInteraction,
  interactions = [] 
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'follow_up' | 'yellow' | 'red'>('yellow');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // Reference Date dynamically retrieved as the latest snapshot date in the system, or default
  const referenceDate = useMemo(() => {
    if (snapshots.length > 0) {
      const sorted = [...snapshots].sort((a,b) => b.snapshot_date.localeCompare(a.snapshot_date));
      return sorted[0].snapshot_date;
    }
    return '2026-06-02';
  }, [snapshots]);

  // Master dynamically computed metrics applying CRM overrides reactively
  const metrics = useMemo(() => {
    return calculateDashboardMetrics(snapshots, interactions, flows, referenceDate);
  }, [snapshots, interactions, flows, referenceDate]);

  // Expand student snapshots with calculated state and manual CRM overrides
  const studentListDetailed = useMemo(() => {
    const latestInterMap = new Map<string, Interaction>();
    const sortedInteractions = [...interactions].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const inter of sortedInteractions) {
      latestInterMap.set(inter.student_email, inter);
    }

    const latestSnaps = getLatestSnapshots(snapshots);
    
    return latestSnaps.map(s => {
      const expectedUnit = getExpectedUnitForFlow(s.flow_number);
      const delta = s.current_unit - expectedUnit;
      const inter = latestInterMap.get(s.email);
      
      let currentStatus: SystemStatus = s.system_status;
      let nextContactStr = s.next_contact_date || '';
      
      if (inter) {
        if (inter.result_status === 'Заморозка' || inter.result_status === 'Перенос потока') {
          currentStatus = 'Freeze';
        } else if (inter.result_status === 'Отказ / Закрыть' || inter.result_status === 'Мороз') {
          currentStatus = 'Churn';
        } else if (inter.next_contact_date) {
          nextContactStr = inter.next_contact_date;
        }
      } else {
        if (expectedUnit >= 14 && s.current_unit >= 13) {
          currentStatus = 'Graduated';
        } else if (delta <= -5 && s.no_movement_counter >= 2) {
          currentStatus = 'Churn';
        } else if (delta <= -5) {
          currentStatus = 'Red';
        } else if (delta === -3 || delta === -4) {
          currentStatus = 'Yellow';
        } else {
          currentStatus = 'Green';
        }
      }
      
      return {
        ...s,
        delta,
        calculated_status: currentStatus,
        next_contact_date: nextContactStr,
        latest_interaction: inter,
        expected_unit: expectedUnit
      };
    });
  }, [snapshots, interactions]);

  // Filter lists based on tab states
  const followUpStudents = useMemo(() => {
    return studentListDetailed.filter(s => 
      s.calculated_status !== 'Graduated' && 
      s.calculated_status !== 'Churn' && 
      s.calculated_status !== 'Freeze' && 
      s.next_contact_date && 
      s.next_contact_date <= referenceDate
    );
  }, [studentListDetailed, referenceDate]);

  const yellowStudents = useMemo(() => {
    return studentListDetailed.filter(s => 
      s.calculated_status === 'Yellow' && 
      (!s.next_contact_date || s.next_contact_date <= referenceDate)
    );
  }, [studentListDetailed, referenceDate]);

  const redStudents = useMemo(() => {
    return studentListDetailed.filter(s => 
      s.calculated_status === 'Red' && 
      (!s.next_contact_date || s.next_contact_date <= referenceDate)
    );
  }, [studentListDetailed, referenceDate]);

  const currentTabStudents = useMemo(() => {
    if (activeTab === 'follow_up') return followUpStudents;
    if (activeTab === 'yellow') return yellowStudents;
    return redStudents;
  }, [activeTab, followUpStudents, yellowStudents, redStudents]);

  return (
    <div className="flex flex-col xl:flex-row gap-8">
      {/* LEFT COLUMN: CRM WORKSPACE */}
      <div className="flex-[3] flex flex-col bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden min-h-[500px]">
        <div className="px-6 pt-6 pb-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-1">Рабочий кабинет ретеншн-менеджера</h2>
              <h3 className="text-2xl font-black text-[#1A1A1A]">Приоритетные студенты</h3>
              {snapshots.length > 0 && (
                <p className="text-xs text-[#9CA3AF] mt-1 font-medium">Анализ по состоянию на: {format(parseISO(referenceDate), 'dd.MM.yyyy')}</p>
              )}
            </div>
            
            <div className="flex bg-[#F3F4F6] p-1 rounded-lg w-full md:w-auto overflow-x-auto">
              <button
                onClick={() => setActiveTab('follow_up')}
                className={cn(
                  "flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-1.5",
                  activeTab === 'follow_up'
                    ? "bg-white shadow-sm border border-[#E5E7EB] text-[#1A1A1A]"
                    : "text-[#6B7280] hover:text-[#1A1A1A]"
                )}
              >
                <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                Следующий звонок
                {followUpStudents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-blue-100 text-blue-700 rounded-full">
                    {followUpStudents.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('yellow')}
                className={cn(
                  "flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-1.5",
                  activeTab === 'yellow'
                    ? "bg-white shadow-sm border border-[#E5E7EB] text-[#1A1A1A]"
                    : "text-[#6B7280] hover:text-[#1A1A1A]"
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                В фокусе (Желтая)
                {yellowStudents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-amber-100 text-amber-700 rounded-full">
                    {yellowStudents.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('red')}
                className={cn(
                  "flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-1.5",
                  activeTab === 'red'
                    ? "bg-white shadow-sm border border-[#E5E7EB] text-[#1A1A1A]"
                    : "text-[#6B7280] hover:text-[#1A1A1A]"
                )}
              >
                <X className="w-3.5 h-3.5 text-[#EF4444]" />
                Критичные (Красная)
                {redStudents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-rose-100 text-rose-700 rounded-full">
                    {redStudents.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <StudentList 
             students={currentTabStudents} 
             variant={activeTab}
             onSelectStudent={setSelectedStudent}
          />
        </div>
        
        <div className="p-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex justify-between items-center text-xs">
          <span className="text-[#6B7280] font-medium">
            Показано {currentTabStudents.length} записей в этой секции
          </span>
          <span className="text-xs text-[#9CA3AF] pointer-events-none">Нажмите на строку для ввода CRM контакта</span>
        </div>
      </div>

      {/* RIGHT COLUMN: ANALYTICAL METRICS */}
      <div className="flex-[1.2] flex flex-col gap-6">
        
        {/* SECTION A: GLOBAL NOMINAL TOTALS */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-[#1A1A1A]" />
            <h4 className="text-xs font-black uppercase tracking-widest text-[#6B7280]">Глобальный капитал</h4>
          </div>
          
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs font-medium text-[#4B5563] mb-1">
                <span>База контактов:</span>
                <span className="font-bold text-[#1A1A1A]">{metrics.nominal_totals.total_base_contacts}</span>
              </div>
              <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-[#4B5563] mb-1">
                <span>Выпускники (Завершили):</span>
                <span className="font-bold text-emerald-600">{metrics.nominal_totals.ok_clients_graduated}</span>
              </div>
              <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ 
                  width: `${metrics.nominal_totals.total_base_contacts ? (metrics.nominal_totals.ok_clients_graduated / metrics.nominal_totals.total_base_contacts * 100) : 0}%` 
                }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-[#4B5563] mb-1">
                <span>Архив / Выбыли (Сход):</span>
                <span className="font-bold text-rose-600">{metrics.nominal_totals.archived_slag_churn}</span>
              </div>
              <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ 
                  width: `${metrics.nominal_totals.total_base_contacts ? (metrics.nominal_totals.archived_slag_churn / metrics.nominal_totals.total_base_contacts * 100) : 0}%` 
                }} />
              </div>
            </div>

            <div className="pt-3 border-t border-[#F3F4F6] flex justify-between items-center">
              <span className="text-xs font-bold text-[#1A1A1A]">Активный Капитал:</span>
              <span className="px-2.5 py-1 text-sm font-black bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                {metrics.nominal_totals.active_training_capital}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION B: OPERATIONAL STRUCTURE CARD */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin-slow" />
            <h4 className="text-xs font-black uppercase tracking-widest text-[#6B7280]">Оперативная структура</h4>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-3 bg-[#ECFDF5] rounded-lg border border-emerald-100 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-2 block">В норме</span>
              <span className="text-xl font-bold text-[#065F46]">{metrics.operational_cards.in_norm_green}</span>
            </div>

            <div className="p-3 bg-[#FFFBEB] rounded-lg border border-amber-100 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-2 block">Отстают</span>
              <span className="text-xl font-bold text-[#92400E]">{metrics.operational_cards.lagging_yellow}</span>
            </div>

            <div className="p-3 bg-[#FEF2F2] rounded-lg border border-rose-100 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 mb-2 block">Критично</span>
              <span className="text-xl font-bold text-[#991B1B]">{metrics.operational_cards.critical_red}</span>
            </div>

            <div className="p-3 bg-[#F9FAFB] rounded-lg border border-slate-200 flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 block">Не начали</span>
              <span className="text-xl font-bold text-slate-700">{metrics.operational_cards.not_started}</span>
            </div>
          </div>
        </div>

        {/* PERCENTAGE METRICS CARD */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-black uppercase tracking-widest text-[#6B7280]">Доля Успеха и Удержания</h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3.5 bg-sky-50 rounded-lg border border-sky-100">
              <p className="text-[9px] font-bold uppercase text-sky-600 mb-1">Доля выпускников</p>
              <p className="text-2xl font-black text-sky-900">{metrics.global_percentages.completion_rate}</p>
            </div>
            <div className="text-center p-3.5 bg-[#ECFDF5] rounded-lg border border-emerald-100">
              <p className="text-[9px] font-bold uppercase text-emerald-600 mb-1">Доля удержания</p>
              <p className="text-2xl font-black text-[#065F46]">{metrics.global_percentages.operational_active_retention}</p>
            </div>
          </div>
        </div>

      </div>

      {/* CRM RECORDING MODAL DRAWER */}
      {selectedStudent && addInteraction && (
        <InteractionDrawer 
          student={selectedStudent} 
          snapshots={snapshots}
          referenceDate={referenceDate}
          onClose={() => setSelectedStudent(null)} 
          onSave={addInteraction}
        />
      )}
    </div>
  );
}

function StudentList({ 
  students, 
  variant, 
  onSelectStudent 
}: { 
  students: any[], 
  variant: 'follow_up' | 'yellow' | 'red', 
  onSelectStudent: (student: any) => void 
}) {
  if (students.length === 0) {
    return (
      <div className="p-16 text-center text-[#6B7280]">
        <CheckCircle2 className="w-16 h-16 mx-auto text-[#10B981] opacity-20 mb-4" />
        <p className="font-bold text-sm">Данный список абсолютно пуст!</p>
        <p className="text-xs text-[#9CA3AF] mt-1">Ретеншн показатели в этой секции полностью отработаны.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left whitespace-nowrap table-auto border-collapse">
      <thead className="bg-[#F9FAFB] border-y border-[#E5E7EB] text-[10px] uppercase font-bold tracking-widest text-[#6B7280]">
        <tr>
          <th className="px-6 py-3.5">Email Студента</th>
          <th className="px-6 py-1 text-center">Поток</th>
          <th className="px-6 py-1 text-center">Блок</th>
          <th className="px-6 py-1 text-center">План</th>
          <th className="px-6 py-1 text-center font-bold">Дельта</th>
          {variant === 'follow_up' && <th className="px-6 py-1 text-center">Срок звонка</th>}
        </tr>
      </thead>
      <tbody className="text-xs text-[#1A1A1A]">
        {students.map((student, idx) => {
          const delta = student.delta !== undefined ? student.delta : student.calculated_delta;
          const currentUnit = student.current_unit;
          const flow = student.flow !== undefined ? student.flow : student.flow_number;
          const expected = student.expected_unit !== undefined ? student.expected_unit : getExpectedUnitForFlow(flow);
          
          return (
            <tr 
              key={student.id || idx} 
              onClick={() => onSelectStudent(student)}
              className="border-b border-[#F3F4F6] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <td className="px-6 py-4">
                <div className="font-bold text-[#1A1A1A]">{student.email}</div>
                {student.latest_interaction && (
                  <div className="text-[10px] text-blue-600 mt-0.5 max-w-[200px] truncate">
                    Последний контакт: {student.latest_interaction.result_status} ({student.latest_interaction.comment})
                  </div>
                )}
              </td>
              <td className="px-4 py-4 text-center font-bold text-[#374151]">#{flow}</td>
              <td className="px-4 py-4 text-center">
                <span className="px-2 py-1 bg-[#F3F4F6] text-[#1A1A1A] rounded font-mono text-[11px] font-bold">
                  {String(currentUnit).padStart(2, '0')} / 14
                </span>
              </td>
              <td className="px-4 py-4 text-center">
                <span className="px-2 py-1 bg-[#EEF2F6] text-slate-600 rounded font-mono text-[11px] font-medium">
                  {String(expected).padStart(2, '0')}
                </span>
              </td>
              <td className="px-4 py-4 text-center font-black">
                <span className={cn(
                  "px-2.5 py-1 text-xs rounded-full",
                  delta >= -2
                    ? "bg-emerald-50 text-emerald-700"
                    : delta === -3 || delta === -4
                    ? "bg-amber-50 text-amber-700"
                    : "bg-rose-50 text-rose-700"
                )}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              </td>
              {variant === 'follow_up' && (
                <td className="px-4 py-4 text-center text-xs font-bold text-blue-600">
                  {student.next_contact_date ? format(parseISO(student.next_contact_date), 'dd.MM') : ''}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function InteractionDrawer({ 
  student, 
  snapshots, 
  referenceDate,
  onClose, 
  onSave 
}: { 
  student: any, 
  snapshots: StudentSnapshot[], 
  referenceDate: string,
  onClose: () => void, 
  onSave: (interaction: Interaction, updatedSnapshot?: StudentSnapshot) => void 
}) {
  const [type, setType] = useState<InteractionType>('Звонок');
  const [status, setStatus] = useState<ResultStatus>('НД');
  const [comment, setComment] = useState('');

  const handleSave = () => {
    let nextDate = '';
    let systemStatusUpdate: SystemStatus | null = null;
    const refDateObj = parseISO(referenceDate);

    // Dynamic schedule calculations
    if (status === 'НД') {
      nextDate = format(addDays(refDateObj, 1), 'yyyy-MM-dd');
    } else if (status === 'В работе / На контроле' || status === 'В работе') {
      nextDate = format(addDays(refDateObj, 7), 'yyyy-MM-dd');
    } else if (status === 'Заморозка' || status === 'Мороз') {
      systemStatusUpdate = 'Freeze';
    } else if (status === 'Отказ / Закрыть') {
      systemStatusUpdate = 'Churn';
    }

    const interaction: Interaction = {
      id: uuidv4(),
      student_email: student.email,
      type,
      result_status: status,
      comment: comment.trim() || 'Контакт зафиксирован',
      next_contact_date: nextDate || undefined,
      created_at: new Date().toISOString()
    };

    let updatedSnapshot: StudentSnapshot | undefined;
    const existingSnap = snapshots.find(s => s.email === student.email);

    if (existingSnap) {
      updatedSnapshot = { ...existingSnap };
      if (nextDate) updatedSnapshot.next_contact_date = nextDate;
      if (systemStatusUpdate) {
        updatedSnapshot.system_status = systemStatusUpdate;
      }
    }

    onSave(interaction, updatedSnapshot);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col p-6 animate-in slide-in-from-right duration-250 ease-out border-l border-[#E5E7EB]">
        
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-black text-[#1A1A1A]">Фиксация контакта</h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Ввод CRM лога по студенту</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-[#1A1A1A] hover:bg-slate-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-[#E5E7EB]">
          <p className="text-sm font-bold text-[#1A1A1A] font-mono break-all">{student.email}</p>
          <div className="grid grid-cols-2 gap-4 mt-3 text-[11px] text-[#4B5563]">
            <div>
              <span className="text-[#6B7280]">Номер потока:</span>
              <span className="font-bold text-[#1A1A1A] block text-xs">Поток {student.flow ?? student.flow_number}</span>
            </div>
            <div>
              <span className="text-[#6B7280]">Текущий прогресс:</span>
              <span className="font-bold text-[#1A1A1A] block text-xs">{student.current_unit} / 14 блок</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6B7280] mb-2.5">Тип контакта</label>
            <div className="flex gap-2">
              {(['Звонок', 'Telegram'] as InteractionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5",
                    type === t 
                      ? "bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-sm" 
                      : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-slate-50"
                  )}
                >
                  {t === 'Звонок' ? <Phone className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 rotate-90" />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6B7280] mb-2.5">Результат / Статус</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'НД (Нет ответа)', value: 'НД' },
                { name: 'В работе / На контроле', value: 'В работе / На контроле' },
                { name: 'Заморозка (Фриз)', value: 'Заморозка' },
                { name: 'Отказ / Закрыть', value: 'Отказ / Закрыть' }
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value as any)}
                  className={cn(
                    "py-2.5 px-3 text-[11px] font-bold rounded-lg border transition-all text-left block w-full",
                    status === s.value 
                      ? "bg-blue-50 text-blue-700 border-blue-200 ring-2 ring-blue-100" 
                      : "bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-slate-50"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6B7280] mb-2.5">Комментарий методолога</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Введите подробный комментарий о договоренностях со студентом..."
              className="w-full h-32 p-3 text-xs border border-[#E5E7EB] rounded-lg focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] outline-none resize-none bg-slate-50"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#E5E7EB] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 text-xs font-bold text-[#1A1A1A] bg-white border border-[#E5E7EB] rounded-lg hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 text-xs font-bold text-white bg-[#1A1A1A] border border-[#1A1A1A] rounded-lg hover:bg-black transition-colors"
          >
            Сохранить
          </button>
        </div>
      </div>
    </>
  );
}
