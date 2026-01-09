/**
 * Simulation Web Worker
 * 重い計算をメインスレッドから分離
 */

import { SimulationEngine } from '../engines/SimulationEngine';
import type { SimulationConfig, SimulationResult } from '../types';
import type { InvestmentAllocation, PolicyParameters } from '../types';

export interface WorkerMessage {
  type: 'SIMULATE' | 'SIMULATE_YEARS' | 'MONTE_CARLO' | 'RESET';
  payload: {
    config?: Partial<SimulationConfig>;
    years?: number;
    iterations?: number;
    investments?: InvestmentAllocation;
    policyParams?: Partial<PolicyParameters>;
  };
  id: string;
}

export interface WorkerResponse {
  type: 'RESULT' | 'PROGRESS' | 'ERROR';
  payload: SimulationResult | { progress: number; total: number } | { error: string };
  id: string;
}

let engine: SimulationEngine | null = null;

function ensureEngine(config?: Partial<SimulationConfig>): SimulationEngine {
  if (!engine || config) {
    engine = new SimulationEngine(config);
  }
  return engine;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case 'SIMULATE': {
        const eng = ensureEngine(payload.config);
        if (payload.investments) {
          eng.setInvestments(payload.investments);
        }
        if (payload.policyParams) {
          eng.setPolicyParams(payload.policyParams);
        }
        eng.simulateYear();
        const result = eng.getResult();
        self.postMessage({ type: 'RESULT', payload: result, id } as WorkerResponse);
        break;
      }

      case 'SIMULATE_YEARS': {
        const eng = ensureEngine(payload.config);
        const years = payload.years ?? 10;

        if (payload.investments) {
          eng.setInvestments(payload.investments);
        }
        if (payload.policyParams) {
          eng.setPolicyParams(payload.policyParams);
        }

        // Report progress periodically
        for (let i = 0; i < years; i++) {
          eng.simulateYear();
          if (i % 5 === 0 || i === years - 1) {
            self.postMessage({
              type: 'PROGRESS',
              payload: { progress: i + 1, total: years },
              id,
            } as WorkerResponse);
          }
        }

        const result = eng.getResult();
        self.postMessage({ type: 'RESULT', payload: result, id } as WorkerResponse);
        break;
      }

      case 'MONTE_CARLO': {
        const iterations = payload.iterations ?? 100;
        const years = payload.years ?? 30;
        const results: SimulationResult[] = [];

        for (let i = 0; i < iterations; i++) {
          const eng = new SimulationEngine({
            ...payload.config,
            seed: (payload.config?.seed ?? 12345) + i,
            enableStochasticity: true,
          });

          if (payload.investments) {
            eng.setInvestments(payload.investments);
          }
          if (payload.policyParams) {
            eng.setPolicyParams(payload.policyParams);
          }

          eng.simulateYears(years);
          results.push(eng.getResult());

          // Report progress
          if (i % 10 === 0 || i === iterations - 1) {
            self.postMessage({
              type: 'PROGRESS',
              payload: { progress: i + 1, total: iterations },
              id,
            } as WorkerResponse);
          }
        }

        // Calculate statistics
        const stats = calculateMonteCarloStats(results);
        self.postMessage({
          type: 'RESULT',
          payload: { ...results[0], monteCarloStats: stats },
          id,
        } as WorkerResponse);
        break;
      }

      case 'RESET': {
        engine = null;
        const eng = ensureEngine(payload.config);
        const result = eng.getResult();
        self.postMessage({ type: 'RESULT', payload: result, id } as WorkerResponse);
        break;
      }

      default:
        self.postMessage({
          type: 'ERROR',
          payload: { error: `Unknown message type: ${type}` },
          id,
        } as WorkerResponse);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      id,
    } as WorkerResponse);
  }
};

function calculateMonteCarloStats(results: SimulationResult[]) {
  const scores = results.map(r => r.statistics.avgScore);
  const sorted = [...scores].sort((a, b) => a - b);

  const percentile = (p: number) => {
    const idx = Math.floor((p / 100) * (sorted.length - 1));
    return sorted[idx];
  };

  return {
    mean: scores.reduce((a, b) => a + b, 0) / scores.length,
    std: Math.sqrt(
      scores.reduce((sum, s) => sum + (s - scores.reduce((a, b) => a + b, 0) / scores.length) ** 2, 0) /
        scores.length
    ),
    p5: percentile(5),
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p95: percentile(95),
  };
}
