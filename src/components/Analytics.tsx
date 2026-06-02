import React, { useMemo } from 'react';
import { StudentSnapshot, Flow, AIMetrics, Interaction } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { calculateDashboardMetrics } from '../lib/logic';
import { BarChart3, TrendingUp, AlertCircle, HelpCircle } from 'lucide-react';

interface AnalyticsProps {
  snapshots: StudentSnapshot[]; // latest filtered snapshots
  flows: Flow[];
  rawSnapshots: StudentSnapshot[]; 
  selectedFilter: string;
  aiMetrics?: AIMetrics | null;
  interactions?: Interaction[];
}

export function Analytics({ snapshots, flows, selectedFilter, interactions = [] }: AnalyticsProps) {

  // Dynamically calculate metrics using manual overrides to keep analytics reactive
  const metrics = useMemo(() => {
    // Determine the reference date
    let refDate = '2026-06-02';
    if (snapshots.length > 0) {
      const sorted = [...snapshots].sort((a,b) => b.snapshot_date.localeCompare(a.snapshot_date));
      refDate = sorted[0].snapshot_date;
    }
    
    const results = calculateDashboardMetrics(snapshots, interactions, flows, refDate);
    return results;
  }, [snapshots, interactions, flows]);

  // Data for structural distribution chart
  const chartData = [
    { name: 'В норме (Зел.)', value: metrics.operational_cards.in_norm_green, color: '#10b981' },
    { name: 'Отстают (Желт.)', value: metrics.operational_cards.lagging_yellow, color: '#f59e0b' },
    { name: 'Критично (Красн.)', value: metrics.operational_cards.critical_red, color: '#f43f5e' },
    { name: 'Не начали (Серый)', value: metrics.operational_cards.not_started, color: '#94a3b8' },
    { name: 'Отток (Сход)', value: metrics.nominal_totals.archived_slag_churn, color: '#64748b' }
  ];

  // Retention and Graduation Rates
  const opsRetention = parseFloat(metrics.global_percentages.operational_active_retention.replace('%', '')) || 0;
  const completionRate = parseFloat(metrics.global_percentages.completion_rate.replace('%', '')) || 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-[#1A1A1A]">
      {/* LEFT COLUMN: VISUAL DISTRIBUTION */}
      <div className="flex-[2] bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6 flex flex-col min-h-[400px]">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-[#1A1A1A]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#6B7280]">Состав зон удержания по текущему фильтру</h3>
        </div>
        
        <div className="h-80 w-full mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
              <Tooltip 
                cursor={{fill: '#F8FAFC'}}
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RIGHT COLUMN: REVENUE & KPI PERFORMANCE */}
      <div className="flex-[1] bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-6 flex flex-col justify-between min-h-[400px]">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#6B7280]">Аналитика KPI</h3>
          </div>
          
          <div className="space-y-8">
            {/* Operational Retention Rate (ORR) */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-[#4B5563]">Доля активного удержания (ORR)</span>
                <span className="text-xl font-black text-emerald-600">{opsRetention.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, opsRetention))}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-[#9CA3AF] font-medium">
                <span>Целевой Benchmark: ≥ 75.0%</span>
                <span className={opsRetention >= 75 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                  {opsRetention >= 75 ? 'Выполнено' : 'Требуется фокус'}
                </span>
              </div>
            </div>

            {/* Completion Rate / Graduation Rate */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-[#4B5563]">Доля выпускников (Completion)</span>
                <span className="text-xl font-black text-sky-600">{completionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-[#9CA3AF] font-medium">
                <span>Нормативный Benchmark: 60-70%</span>
                <span className={completionRate >= 60 && completionRate <= 75 ? "text-emerald-700 font-bold" : "text-sky-700 font-bold"}>
                  {completionRate >= 60 && completionRate <= 75 ? 'Норма' : 'Высокий темп'}
                </span>
              </div>
            </div>

            {/* Total Student Capacity Summary */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-[#4B5563]">
                <span>Активно обучаются (Капитал):</span>
                <span className="font-bold text-[#1A1A1A]">{metrics.nominal_totals.active_training_capital}</span>
              </div>
              <div className="flex justify-between text-[#4B5563]">
                <span>Успешно окончили курс:</span>
                <span className="font-bold text-emerald-600">{metrics.nominal_totals.ok_clients_graduated}</span>
              </div>
              <div className="flex justify-between text-[#4B5563]">
                <span>Потери (Архив выбывших):</span>
                <span className="font-bold text-rose-600">{metrics.nominal_totals.archived_slag_churn}</span>
              </div>
            </div>

          </div>
        </div>

        <div className="mt-8">
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-[11px] leading-relaxed text-[#047857] font-medium">
              Все расчеты зон и показателей удержания согласованы с CRM-контрактами Svetlana A. в режиме реального времени.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
