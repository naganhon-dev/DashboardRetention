import React, { useState, useMemo } from 'react';
import { useStore } from './lib/store';
import { getLatestSnapshots } from './lib/logic';
import { Dashboard } from './components/Dashboard';
import { Analytics } from './components/Analytics';
import { DataManagement } from './components/DataManagement';
import { Users, BarChart3, Database, Menu, X } from 'lucide-react';
import { StudentSnapshot } from './types';
import { cn } from './lib/utils';
import { differenceInDays, parseISO } from 'date-fns';

export default function App() {
  const { flows, snapshots, aiMetrics, interactions, updateFlows, addSnapshots, updateSnapshots, updateAiMetrics, addInteraction, isLoaded } = useStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'data'>('dashboard');
  const [selectedFlowFilter, setSelectedFlowFilter] = useState<string>('all_active');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const latestSnapshots = useMemo(() => getLatestSnapshots(snapshots), [snapshots]);

  // Filter logic
  const filteredSnapshots = useMemo(() => {
    let filtered: StudentSnapshot[] = [];
    
    if (selectedFlowFilter === 'all_active') {
      const activeFlowNumbers = flows.filter(f => f.status === 'Active').map(f => f.flow_number);
      filtered = latestSnapshots.filter(s => activeFlowNumbers.includes(s.flow_number));
    } else if (selectedFlowFilter === 'all_graduated') {
      const gradFlowNumbers = flows.filter(f => f.status === 'Graduated').map(f => f.flow_number);
      filtered = latestSnapshots.filter(s => gradFlowNumbers.includes(s.flow_number));
    } else {
      const num = parseInt(selectedFlowFilter, 10);
      filtered = latestSnapshots.filter(s => s.flow_number === num);
    }
    return filtered;
  }, [selectedFlowFilter, latestSnapshots, flows]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-[#1A1A1A]">
      <header className="flex items-center justify-between px-4 sm:px-8 h-16 bg-white border-b border-[#E5E7EB] shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1A1A1A] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">RP</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight uppercase hidden sm:block">Retention <span className="text-[#6B7280]">PRO</span></h1>
          </div>
          <div className="hidden md:block h-8 w-[1px] bg-[#E5E7EB]"></div>
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-md text-sm font-medium hover:border-[#1A1A1A] transition-colors focus-within:border-[#1A1A1A]">
              <span className="text-[#6B7280] hidden sm:inline">Поток:</span>
              <select
                id="flow-filter"
                className="bg-transparent text-[#1A1A1A] text-sm focus:outline-none appearance-none pr-6 cursor-pointer"
                value={selectedFlowFilter}
                onChange={(e) => setSelectedFlowFilter(e.target.value)}
              >
                <option value="all_active">Все активные потоки</option>
                <option value="all_graduated">Все завершенные</option>
                {flows.map(f => (
                  <option key={f.id} value={f.flow_number.toString()}>
                    Поток {f.flow_number} ({f.status === 'Active' ? 'Активный' : 'Завершен'})
                  </option>
                ))}
              </select>
              <svg className="w-4 h-4 text-[#9CA3AF] absolute right-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex space-x-1">
            <TabButton 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={<Users className="w-4 h-4 mr-2" />} 
              label="Дашборд" 
            />
            <TabButton 
              active={activeTab === 'analytics'} 
              onClick={() => setActiveTab('analytics')} 
              icon={<BarChart3 className="w-4 h-4 mr-2" />} 
              label="Аналитика" 
            />
            <TabButton 
              active={activeTab === 'data'} 
              onClick={() => setActiveTab('data')} 
              icon={<Database className="w-4 h-4 mr-2" />} 
              label="Данные (CSV)" 
            />
          </nav>
          <div className="hidden lg:flex items-center gap-4 text-sm ml-4 pl-4 border-l border-[#E5E7EB]">
            <span className="text-[#6B7280] font-medium hidden xl:inline">Методолог: <span className="text-[#1A1A1A]">Светлана А.</span></span>
            <div className="w-8 h-8 rounded-full bg-[#E5E7EB] border border-white shrink-0"></div>
          </div>
          <button 
            className="md:hidden p-2 rounded-md text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F3F4F6] focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E5E7EB] bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <MobileTabButton 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} 
              label="Дашборд" 
            />
            <MobileTabButton 
              active={activeTab === 'analytics'} 
              onClick={() => { setActiveTab('analytics'); setMobileMenuOpen(false); }} 
              label="Аналитика" 
            />
            <MobileTabButton 
              active={activeTab === 'data'} 
              onClick={() => { setActiveTab('data'); setMobileMenuOpen(false); }} 
              label="Данные (CSV)" 
            />
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-full lg:max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <Dashboard 
            snapshots={filteredSnapshots} 
            flows={flows} 
            selectedFilter={selectedFlowFilter} 
            aiMetrics={aiMetrics} 
            updateSnapshots={updateSnapshots} 
            addInteraction={addInteraction} 
            interactions={interactions}
          />
        )}
        {activeTab === 'analytics' && (
          <Analytics 
            snapshots={filteredSnapshots} 
            flows={flows} 
            rawSnapshots={snapshots} 
            selectedFilter={selectedFlowFilter} 
            aiMetrics={aiMetrics} 
            interactions={interactions}
          />
        )}
        {activeTab === 'data' && (
          <DataManagement 
            flows={flows} 
            updateFlows={updateFlows} 
            existingSnapshots={snapshots} 
            addSnapshots={addSnapshots} 
            updateAiMetrics={updateAiMetrics} 
          />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon?: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center px-4 py-2 text-sm font-bold rounded-md transition-colors",
        active 
          ? "bg-[#1A1A1A] text-white" 
          : "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F3F4F6]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileTabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "block w-full text-left px-3 py-2 rounded-md text-base font-bold",
        active 
          ? "bg-[#1A1A1A] text-white" 
          : "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F3F4F6]"
      )}
    >
      {label}
    </button>
  );
}
