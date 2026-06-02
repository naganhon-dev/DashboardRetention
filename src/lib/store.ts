import { useState, useEffect } from 'react';
import { Flow, StudentSnapshot, AIMetrics, Interaction } from '../types';
import { autoUpdateFlows, getStartDateForFlow } from './logic';

export function useStore() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [snapshots, setSnapshots] = useState<StudentSnapshot[]>([]);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedFlows = localStorage.getItem('retention-flows');
    const savedSnapshots = localStorage.getItem('retention-snapshots');
    const savedAiMetrics = localStorage.getItem('retention-aimetrics');
    const savedInteractions = localStorage.getItem('retention-interactions');
    
    let initialFlows = savedFlows ? JSON.parse(savedFlows) : [];
    if (initialFlows.length === 0) {
      const seededFlows = [];
      for (let fNum = 42; fNum <= 60; fNum++) {
        seededFlows.push({
          id: `flow-seed-${fNum}`,
          flow_number: fNum,
          start_date: getStartDateForFlow(fNum),
          status: fNum <= 56 ? 'Graduated' : 'Active'
        });
      }
      initialFlows = seededFlows;
    } else {
      // Auto-graduate flows
      initialFlows = autoUpdateFlows(initialFlows);
    }
    localStorage.setItem('retention-flows', JSON.stringify(initialFlows));

    setFlows(initialFlows);
    setSnapshots(savedSnapshots ? JSON.parse(savedSnapshots) : []);
    setAiMetrics(savedAiMetrics ? JSON.parse(savedAiMetrics) : null);
    setInteractions(savedInteractions ? JSON.parse(savedInteractions) : []);
    setIsLoaded(true);
  }, []);

  const updateFlows = (newFlows: Flow[]) => {
    setFlows(newFlows);
    localStorage.setItem('retention-flows', JSON.stringify(newFlows));
  };

  const updateSnapshots = (newSnapshots: StudentSnapshot[]) => {
    setSnapshots(newSnapshots);
    localStorage.setItem('retention-snapshots', JSON.stringify(newSnapshots));
  };
  
  const addInteraction = (interaction: Interaction, updatedSnapshot?: StudentSnapshot) => {
    const newInteractions = [...interactions, interaction];
    setInteractions(newInteractions);
    localStorage.setItem('retention-interactions', JSON.stringify(newInteractions));
    
    if (updatedSnapshot) {
      const newSnapshots = snapshots.map(s => s.id === updatedSnapshot.id ? updatedSnapshot : s);
      updateSnapshots(newSnapshots);
    }
  };

  const addSnapshots = (newSnapshots: StudentSnapshot[]) => {
    const combined = [...snapshots, ...newSnapshots];
    updateSnapshots(combined);
  };

  const updateAiMetrics = (metrics: AIMetrics | null) => {
    setAiMetrics(metrics);
    if (metrics) {
      localStorage.setItem('retention-aimetrics', JSON.stringify(metrics));
    } else {
      localStorage.removeItem('retention-aimetrics');
    }
  };

  const clearAllData = () => {
    localStorage.removeItem('retention-flows');
    localStorage.removeItem('retention-snapshots');
    localStorage.removeItem('retention-aimetrics');
    localStorage.removeItem('retention-interactions');
    
    const seededFlows = [];
    for (let fNum = 42; fNum <= 60; fNum++) {
      seededFlows.push({
        id: `flow-seed-${fNum}`,
        flow_number: fNum,
        start_date: getStartDateForFlow(fNum),
        status: fNum <= 56 ? 'Graduated' : 'Active'
      });
    }
    setFlows(seededFlows);
    localStorage.setItem('retention-flows', JSON.stringify(seededFlows));

    setSnapshots([]);
    setAiMetrics(null);
    setInteractions([]);
  };

  return { flows, snapshots, aiMetrics, interactions, updateFlows, updateSnapshots, addSnapshots, updateAiMetrics, addInteraction, clearAllData, isLoaded };
}
