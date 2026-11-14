/** Queries over the local Tauri commands (no network). */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/services/queryClient';
import { commands } from '@/lib/tauri';

/** Bundled CLI version and check result. */
export const useCliInfo = () => useQuery({ queryKey: qk.cliInfo, queryFn: commands.cliInfo, staleTime: Infinity });

/** macOS version, architecture, RAM and the device id. */
export const useSystemInfo = () => useQuery({ queryKey: qk.systemInfo, queryFn: commands.systemInfo, staleTime: Infinity });

/** Disk status of the Data volume. */
export const useDisk = () => useQuery({ queryKey: qk.disk, queryFn: commands.diskStatus, staleTime: 15_000 });

/** Local reports and logs, newest first (bounded). */
export const useLocalHistory = (limit = 20) =>
  useQuery({ queryKey: qk.localHistory(limit), queryFn: () => commands.listLocalHistory(Math.min(limit, 50)) });

/** Full Disk Access, battery and SMART (read-only). */
export const useHealth = () => useQuery({ queryKey: ['health'], queryFn: commands.healthInfo, staleTime: 60_000 });

/** Time Machine destination and last backup (read-only). */
export const useBackup = () => useQuery({ queryKey: ['backup'], queryFn: commands.backupStatus, staleTime: 60_000 });
