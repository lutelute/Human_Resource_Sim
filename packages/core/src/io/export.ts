/**
 * Export/Import Functions
 * データのエクスポート・インポート機能
 */

import type {
  SimulationState,
  HistoryEntry,
  ExportFormat,
} from '../types';
import { CAPABILITY_AXIS_KEYS } from '../types';

const EXPORT_VERSION = '4.0.0';

/**
 * Calculate SHA-256 checksum of data (simplified version for browser)
 */
async function calculateChecksum(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }
  // Fallback: simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Export simulation state to JSON format
 */
export async function exportToJSON(
  state: SimulationState,
  history: HistoryEntry[]
): Promise<string> {
  const dataWithoutChecksum = {
    version: EXPORT_VERSION,
    timestamp: new Date().toISOString(),
    seed: state.config.seed,
    state,
    history,
  };

  const checksum = await calculateChecksum(JSON.stringify(dataWithoutChecksum));

  const exportData: ExportFormat = {
    ...dataWithoutChecksum,
    checksum,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export history to CSV format
 */
export function exportHistoryToCSV(history: HistoryEntry[]): string {
  const headers = [
    'year',
    ...CAPABILITY_AXIS_KEYS,
    'totalScore',
    'successionScore',
    'totalTalent',
  ].join(',');

  const rows = history.map(entry => {
    const capValues = CAPABILITY_AXIS_KEYS.map(key =>
      entry.capability[key]?.toFixed(2) ?? '0'
    );
    return [
      entry.year,
      ...capValues,
      entry.totalScore?.toFixed(2) ?? '0',
      entry.successionScore?.toFixed(2) ?? '0',
      entry.totalTalent,
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Import simulation state from JSON
 */
export async function importFromJSON(json: string): Promise<ExportFormat> {
  const data = JSON.parse(json) as ExportFormat;

  // Validate version
  if (!data.version) {
    throw new Error('Invalid export format: missing version');
  }

  // Validate checksum
  const storedChecksum = data.checksum;
  const dataWithoutChecksum = { ...data };
  delete (dataWithoutChecksum as Record<string, unknown>).checksum;

  const calculatedChecksum = await calculateChecksum(JSON.stringify(dataWithoutChecksum));

  if (storedChecksum !== calculatedChecksum) {
    console.warn('Checksum mismatch - data may have been modified');
  }

  // Validate required fields
  if (!data.state || !data.history) {
    throw new Error('Invalid export format: missing state or history');
  }

  return data;
}

/**
 * Create downloadable blob from export data
 */
export function createDownloadBlob(content: string, type: 'json' | 'csv'): Blob {
  const mimeType = type === 'json' ? 'application/json' : 'text/csv';
  return new Blob([content], { type: mimeType });
}

/**
 * Trigger file download in browser
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
