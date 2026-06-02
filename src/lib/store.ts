import { useState, useEffect } from 'react';
import { Flow, StudentSnapshot, AIMetrics, Interaction } from '../types';
import { autoUpdateFlows, getStartDateForFlow } from './logic';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export function useStore() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [snapshots, setSnapshots] = useState<StudentSnapshot[]>([]);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch flows
        const flowsQuery = await getDocs(collection(db, 'flows'));
        let firestoreFlows = flowsQuery.docs.map(d => d.data() as Flow);
        
        if (firestoreFlows.length === 0) {
          // Seed default flows
          const seededFlows: Flow[] = [];
          for (let fNum = 42; fNum <= 60; fNum++) {
            seededFlows.push({
              id: `flow-seed-${fNum}`,
              flow_number: fNum,
              start_date: getStartDateForFlow(fNum),
              status: fNum <= 56 ? 'Graduated' : 'Active'
            });
          }
          // Save seeded flows to Firestore
          for (const f of seededFlows) {
            await setDoc(doc(db, 'flows', f.id), f);
          }
          firestoreFlows = seededFlows;
        } else {
          // Auto-graduate older flows
          const updated = autoUpdateFlows(firestoreFlows);
          let changed = false;
          for (const flow of updated) {
            const original = firestoreFlows.find(f => f.id === flow.id);
            if (original && original.status !== flow.status) {
              await setDoc(doc(db, 'flows', flow.id), flow);
              changed = true;
            }
          }
          if (changed) {
            firestoreFlows = updated;
          }
        }
        
        // Sort flows descending
        firestoreFlows.sort((a, b) => b.flow_number - a.flow_number);
        setFlows(firestoreFlows);
        localStorage.setItem('retention-flows', JSON.stringify(firestoreFlows));

        // 2. Fetch snapshots
        const snapsQuery = await getDocs(collection(db, 'snapshots'));
        const firestoreSnaps = snapsQuery.docs.map(d => d.data() as StudentSnapshot);
        setSnapshots(firestoreSnaps);
        localStorage.setItem('retention-snapshots', JSON.stringify(firestoreSnaps));

        // 3. Fetch interactions
        const interQuery = await getDocs(collection(db, 'interactions'));
        const firestoreInter = interQuery.docs.map(d => d.data() as Interaction);
        setInteractions(firestoreInter);
        localStorage.setItem('retention-interactions', JSON.stringify(firestoreInter));

        // 4. Fetch aiMetrics
        const metricsQuery = await getDocs(collection(db, 'aimetrics'));
        if (!metricsQuery.empty) {
          const metrics = metricsQuery.docs[0].data() as AIMetrics;
          setAiMetrics(metrics);
          localStorage.setItem('retention-aimetrics', JSON.stringify(metrics));
        } else {
          setAiMetrics(null);
          localStorage.removeItem('retention-aimetrics');
        }

        setIsLoaded(true);
      } catch (err) {
        console.warn("Firestore access error, loading from local cache fallback:", err);
        
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
          initialFlows = autoUpdateFlows(initialFlows);
        }
        
        initialFlows.sort((a: Flow, b: Flow) => b.flow_number - a.flow_number);
        setFlows(initialFlows);
        setSnapshots(savedSnapshots ? JSON.parse(savedSnapshots) : []);
        setAiMetrics(savedAiMetrics ? JSON.parse(savedAiMetrics) : null);
        setInteractions(savedInteractions ? JSON.parse(savedInteractions) : []);
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  const updateFlows = async (newFlows: Flow[]) => {
    setFlows(newFlows);
    localStorage.setItem('retention-flows', JSON.stringify(newFlows));
    
    try {
      // Keep Firestore flows table in sync
      const batch = writeBatch(db);
      for (const flow of newFlows) {
        batch.set(doc(db, 'flows', flow.id), flow);
      }
      await batch.commit();

      // Delete flows that are no longer present
      const currentQuery = await getDocs(collection(db, 'flows'));
      for (const docSnap of currentQuery.docs) {
        if (!newFlows.some(f => f.id === docSnap.id)) {
          await deleteDoc(docSnap.ref);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'flows');
    }
  };

  const updateSnapshots = async (newSnapshots: StudentSnapshot[]) => {
    setSnapshots(newSnapshots);
    localStorage.setItem('retention-snapshots', JSON.stringify(newSnapshots));
  };
  
  const addInteraction = async (interaction: Interaction, updatedSnapshot?: StudentSnapshot) => {
    const newInteractions = [...interactions, interaction];
    setInteractions(newInteractions);
    localStorage.setItem('retention-interactions', JSON.stringify(newInteractions));
    
    try {
      await setDoc(doc(db, 'interactions', interaction.id), interaction);
      if (updatedSnapshot) {
        const newSnapshots = snapshots.map(s => s.id === updatedSnapshot.id ? updatedSnapshot : s);
        setSnapshots(newSnapshots);
        localStorage.setItem('retention-snapshots', JSON.stringify(newSnapshots));
        await setDoc(doc(db, 'snapshots', updatedSnapshot.id!), updatedSnapshot);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `interactions/${interaction.id}`);
    }
  };

  const addSnapshots = async (newSnapshots: StudentSnapshot[]) => {
    const combined = [...snapshots, ...newSnapshots];
    setSnapshots(combined);
    localStorage.setItem('retention-snapshots', JSON.stringify(combined));

    try {
      const chunkSize = 400;
      for (let i = 0; i < newSnapshots.length; i += chunkSize) {
        const chunk = newSnapshots.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const snap of chunk) {
          const docId = snap.id || uuidv4();
          batch.set(doc(db, 'snapshots', docId), snap);
        }
        await batch.commit();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'snapshots-batch');
    }
  };

  const updateAiMetrics = async (metrics: AIMetrics | null) => {
    setAiMetrics(metrics);
    if (metrics) {
      localStorage.setItem('retention-aimetrics', JSON.stringify(metrics));
      try {
        await setDoc(doc(db, 'aimetrics', 'latest'), metrics);
      } catch (e) {
        console.error("Firestore AI metrics write error:", e);
      }
    } else {
      localStorage.removeItem('retention-aimetrics');
      try {
        await deleteDoc(doc(db, 'aimetrics', 'latest'));
      } catch (e) {
        console.error("Firestore AI metrics delete error:", e);
      }
    }
  };

  const clearAllData = async () => {
    // 1. Local Storage Cleanup
    localStorage.removeItem('retention-flows');
    localStorage.removeItem('retention-snapshots');
    localStorage.removeItem('retention-aimetrics');
    localStorage.removeItem('retention-interactions');
    
    // 2. Clear state
    setSnapshots([]);
    setAiMetrics(null);
    setInteractions([]);

    const seededFlows: Flow[] = [];
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

    // 3. Firestore Purge
    try {
      const chunkDoc = (docs: any[], size: number) => {
        const chunks = [];
        for (let i = 0; i < docs.length; i += size) {
          chunks.push(docs.slice(i, i + size));
        }
        return chunks;
      };

      // Purge snapshots
      const snapsQuery = await getDocs(collection(db, 'snapshots'));
      const snapChunks = chunkDoc(snapsQuery.docs, 400);
      for (const chunk of snapChunks) {
        const batch = writeBatch(db);
        for (const docSnap of chunk) {
          batch.delete(docSnap.ref);
        }
        await batch.commit();
      }

      // Purge interactions
      const interQuery = await getDocs(collection(db, 'interactions'));
      const interChunks = chunkDoc(interQuery.docs, 400);
      for (const chunk of interChunks) {
        const batch = writeBatch(db);
        for (const docSnap of chunk) {
          batch.delete(docSnap.ref);
        }
        await batch.commit();
      }

      // Purge metrics
      await deleteDoc(doc(db, 'aimetrics', 'latest'));

      // Purge & rewrite flows
      const flowsQuery = await getDocs(collection(db, 'flows'));
      for (const docSnap of flowsQuery.docs) {
        await deleteDoc(docSnap.ref);
      }
      const flowBatch = writeBatch(db);
      for (const f of seededFlows) {
        flowBatch.set(doc(db, 'flows', f.id), f);
      }
      await flowBatch.commit();
    } catch (e) {
      console.error("Firestore cleanup error:", e);
    }
  };

  return { flows, snapshots, aiMetrics, interactions, updateFlows, updateSnapshots, addSnapshots, updateAiMetrics, addInteraction, clearAllData, isLoaded };
}
