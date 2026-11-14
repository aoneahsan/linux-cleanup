/** Queries over the local Tauri commands (no network). */
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/services/queryClient';
import { commands } from '@/lib/tauri';

/** Bundled CLI version and check result. */
export const useCliInfo = () => useQuery({ queryKey: qk.cliInfo, queryFn: commands.cliInfo, staleTime: Infinity });

/** Distribution name, architecture, RAM and the device id. */
export const useSystemInfo = () => useQuery({ queryKey: qk.systemInfo, queryFn: commands.systemInfo, staleTime: Infinity });

/** Disk status of the volume holding the home folder. */
export const useDisk = () => useQuery({ queryKey: qk.disk, queryFn: commands.diskStatus, staleTime: 15_000 });

/** Local reports and logs, newest first (bounded). */
export const useLocalHistory = (limit = 20) =>
  useQuery({ queryKey: qk.localHistory(limit), queryFn: () => commands.listLocalHistory(Math.min(limit, 50)) });

