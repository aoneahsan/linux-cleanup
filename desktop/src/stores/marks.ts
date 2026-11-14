/** Review marks on orphans, apps and launch items (local to this Mac; paths never leave it). */
import { create } from 'zustand';
import { load, save } from '@/lib/storage';

export type OrphanMark = 'keep' | 'review';

export type ToolMark = 'keep' | 'remove';

interface MarksState {
  orphans: Record<string, OrphanMark>;
  tools: Record<string, ToolMark>;
  markOrphan: (path: string, mark: OrphanMark | null) => void;
  markTool: (path: string, mark: ToolMark) => void;
}

export const useMarks = create<MarksState>((set, get) => ({
  orphans: load<Record<string, OrphanMark>>('orphan-marks', {}),
  tools: load<Record<string, ToolMark>>('tool-marks', {}),
  markTool: (path, mark) => {
    const tools = { ...get().tools, [path]: mark };
    save('tool-marks', tools);
    set({ tools });
  },
  markOrphan: (path, mark) => {
    const orphans = { ...get().orphans };
    if (mark) orphans[path] = mark;
    else delete orphans[path];
    save('orphan-marks', orphans);
    set({ orphans });
  },
}));
