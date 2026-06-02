import { useState, useEffect } from 'react';
import { Flow, StudentSnapshot, AIMetrics, Interaction } from '../types';
import { autoUpdateFlows } from './logic';

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
    const initialSnapshots = savedSnapshots ? JSON.parse(savedSnapshots) : [];
    const initialAiMetrics = savedAiMetrics ? JSON.parse(savedAiMetrics) : null;
    const initialInteractions = savedInteractions ? JSON.parse(savedInteractions) : [];

    // Auto-graduate flows
    initialFlows = autoUpdateFlows(initialFlows);
    localStorage.setItem('retention-flows', JSON.stringify(initialFlows));

    setFlows(initialFlows);
    setSnapshots(initialSnapshots);
    setAiMetrics(initialAiMetrics);
    setInteractions(initialInteractions);
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

  return { flows, snapshots, aiMetrics, interactions, updateFlows, updateSnapshots, addSnapshots, updateAiMetrics, addInteraction, isLoaded };
}
