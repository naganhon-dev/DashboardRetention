import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { Flow, StudentSnapshot, AIMetrics } from '../types';
import { processNewSnapshots } from '../lib/logic';
import { Calendar, Upload, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DataManagementProps {
  flows: Flow[];
  updateFlows: (flows: Flow[]) => void;
  existingSnapshots: StudentSnapshot[];
  addSnapshots: (snapshots: StudentSnapshot[]) => void;
  updateAiMetrics?: (metrics: AIMetrics | null) => void;
}

export function DataManagement({ flows, updateFlows, existingSnapshots, addSnapshots, updateAiMetrics }: DataManagementProps) {
  const [newFlowNumber, setNewFlowNumber] = useState('');
  const [newFlowDate, setNewFlowDate] = useState('');
  const [snapshotDate, setSnapshotDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generatePreviousCsv = () => {
    if (!existingSnapshots.length) return '';
    // Optional: Get only the most recent snapshot per email
    const latestMap = new Map<string, StudentSnapshot>();
    for (const snap of existingSnapshots) {
      const existing = latestMap.get(snap.email);
      if (!existing || snap.snapshot_date > existing.snapshot_date) {
        latestMap.set(snap.email, snap);
      }
    }
    
    let csv = "Email,Поток,Блок\n";
    for (const snap of latestMap.values()) {
      csv += `${snap.email},${snap.flow_number},${snap.current_unit}\n`;
    }
    return csv;
  };

  const handleAddFlow = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(newFlowNumber, 10);
    if (isNaN(num) || flows.find(f => f.flow_number === num)) {
      alert('Неверный номер потока или поток уже существует');
      return;
    }
    if (!newFlowDate) {
      alert('Выберите дату старта');
      return;
    }

    const newFlow: Flow = {
      id: uuidv4(),
      flow_number: num,
      start_date: newFlowDate,
      status: 'Active'
    };

    updateFlows([...flows, newFlow].sort((a,b) => b.flow_number - a.flow_number));
    setNewFlowNumber('');
    setNewFlowDate('');
  };

  const handleDeleteFlow = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот поток? Исторические данные сохранятся, но новые расчеты могут нарушиться.')) {
      updateFlows(flows.filter(f => f.id !== id));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Загрузка и анализ через AI Studio...');

    try {
      const currentCsv = await file.text();
      const previousCsv = generatePreviousCsv();

      const res = await fetch('/api/process-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCsv, previousCsv, snapshotDate })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server error');
      }

      const aiData = await res.json();
      if (updateAiMetrics) {
        updateAiMetrics(aiData);
      }

      // Also parse locally for offline local state
      Papa.parse(currentCsv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const { newSnapshots, newFlows } = processNewSnapshots(results.data, snapshotDate, flows, existingSnapshots);
            if (newFlows.length > 0) {
              updateFlows([...flows, ...newFlows]);
            }
            addSnapshots(newSnapshots);
            setUploadStatus('Успешно! Отчет AI сгенерирован и локальные данные сохранены.');
            if (fileInputRef.current) fileInputRef.current.value = '';
          } catch (err: any) {
            setUploadStatus(`Отчет AI готов, но локальное сохранение дало ошибку: ${err.message}`);
          }
        }
      });
      
    } catch (err: any) {
      setUploadStatus(`Ошибка AI: ${err.message}`);
      // Fallback local logic
      const currentCsv = await file.text();
      Papa.parse(currentCsv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const { newSnapshots, newFlows } = processNewSnapshots(results.data, snapshotDate, flows, existingSnapshots);
            if (newFlows.length > 0) {
              updateFlows([...flows, ...newFlows]);
            }
            addSnapshots(newSnapshots);
            setUploadStatus(`Успешно (AI недоступен)! Добавлено локально записей: ${newSnapshots.length}.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
          } catch (internalErr: any) {
             setUploadStatus(`Ошибка обработки: ${internalErr.message}`);
          }
        }
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-[#1A1A1A]">
      {/* Upload CSV */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6 self-start">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-6 flex items-center">
          <Upload className="w-4 h-4 mr-2" />
          Импорт недельного среза (CSV)
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Опорная дата (Snapshot Date)</label>
            <input 
              type="date" 
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="bg-[#F9FAFB] border border-[#E5E7EB] text-[#1A1A1A] text-sm rounded-lg focus:ring-[#1A1A1A] focus:border-[#1A1A1A] block w-full p-2.5"
            />
            <p className="mt-1 text-xs text-[#6B7280]">По умолчанию — сегодня. Используется для расчета дельты.</p>
          </div>

          <div className="border-2 border-dashed border-[#D1D5DB] rounded-lg p-8 flex flex-col items-center justify-center bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors">
            <input 
              type="file" 
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden" 
              id="csv-upload" 
            />
            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-8 h-8 text-[#9CA3AF] mb-3" />
              <span className="text-sm font-bold text-[#1A1A1A] underline decoration-2 underline-offset-4 hover:text-[#4B5563]">Выберите CSV файл</span>
              <span className="text-xs text-[#6B7280] mt-2">Ожидаемые колонки: Email, Поток, Блок</span>
            </label>
          </div>

          {uploadStatus && (
            <div className={`p-3 text-sm rounded-lg flex items-start ${uploadStatus.includes('Success') ? 'bg-[#ECFDF5] text-[#065F46] border border-[#10B981] border-opacity-20' : 'bg-[#FEF2F2] text-[#991B1B] border border-[#EF4444] border-opacity-20'}`}>
              <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Manage Flows */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-6 flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          Календарь потоков
        </h2>

        <form onSubmit={handleAddFlow} className="flex gap-3 mb-6 bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
          <div className="flex-1">
            <input 
              type="number" 
              placeholder="Номер (напр. 60)" 
              value={newFlowNumber}
              onChange={(e) => setNewFlowNumber(e.target.value)}
              className="bg-white border border-[#E5E7EB] text-[#1A1A1A] text-sm rounded-lg block w-full p-2"
              required
            />
          </div>
          <div className="flex-1">
            <input 
              type="date" 
              value={newFlowDate}
              onChange={(e) => setNewFlowDate(e.target.value)}
              className="bg-white border border-[#E5E7EB] text-[#1A1A1A] text-sm rounded-lg block w-full p-2"
              required
            />
          </div>
          <button 
            type="submit"
            className="bg-[#1A1A1A] text-white p-2 rounded-lg hover:bg-[#374151] transition-colors"
            title="Добавить поток"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#F9FAFB] border-y border-[#E5E7EB] text-[11px] uppercase tracking-wider text-[#6B7280] font-bold">
              <tr>
                <th className="px-4 py-3">Поток</th>
                <th className="px-4 py-3">Старт (Блок 1)</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {flows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#6B7280]">
                    Нет активных потоков. Добавьте первый.
                  </td>
                </tr>
              )}
              {flows.map(flow => (
                <tr key={flow.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-4 py-4 font-bold text-[#1A1A1A]">#{flow.flow_number}</td>
                  <td className="px-4 py-4">{format(parseISO(flow.start_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      flow.status === 'Active' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}>
                      {flow.status === 'Active' ? 'Активный' : 'Завершен'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteFlow(flow.id)}
                      className="text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
