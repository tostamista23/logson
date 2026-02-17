import { Injectable } from '@angular/core';
import { LogEntry } from './log-parser.service';

export interface ChartData {
  labels: string[];
  datasets: any[];
}

export interface LevelStats {
  [level: string]: number;
}

export interface TypeStats {
  [type: string]: number;
}

export interface StatusCodeStats {
  [code: number]: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChartStatsService {

  getLevelDistribution(logs: LogEntry[]): ChartData {
    const stats: LevelStats = {};
    const colors = new Map<string, string>([
      ['Error', '#dc2626'],
      ['Warning', '#eab308'],
      ['Information', '#3b82f6'],
      ['Debug', '#6b7280'],
      ['Trace', '#6b7280'],
      ['Critical', '#dc2626']
    ]);

    for (const log of logs) {
      stats[log.level] = (stats[log.level] || 0) + 1;
    }

    const labels = Object.keys(stats);
    const backgroundColors = labels.map(level => colors.get(level) || '#6b7280');

    return {
      labels,
      datasets: [
        {
          label: 'Logs by Level',
          data: labels.map(level => stats[level]),
          backgroundColor: backgroundColors,
          borderColor: '#1f2937',
          borderWidth: 2
        }
      ]
    };
  }

  getTypeDistribution(logs: LogEntry[]): ChartData {
    const stats: TypeStats = {};

    // explicit mapping for known types to avoid collisions (static vs http issue)
    const explicitColors: { [type: string]: string } = {
      HTTP: '#10b981',      // green
      App: '#6366f1',       // indigo - distinct from HTTP
      Security: '#06b6d4',  // cyan - distinct from ORM
      ORM: '#8b5cf6',       // purple
      Migration: '#f472b6', // pink
      Database: '#0ea5e9',  // sky blue
      Error: '#dc2626',     // red
      Warning: '#f59e0b',   // yellow/orange
      // swap Log color with Static to avoid red for Log
      Log: '#6b7280',       // gray (used previously for Static)
      Static: '#94a3b8'      // new slate-blue-ish color
    };

    for (const log of logs) {
      stats[log.type] = (stats[log.type] || 0) + 1;
    }

    // sort by count descending
    let labels = Object.keys(stats).sort((a, b) => stats[b] - stats[a]);

    // if there are too many distinct types, only show top N and group the rest as "Other"
    const MAX_SEGMENTS = 20;
    if (labels.length > MAX_SEGMENTS) {
      const top = labels.slice(0, MAX_SEGMENTS);
      const others = labels.slice(MAX_SEGMENTS);
      const otherCount = others.reduce((sum, lbl) => sum + stats[lbl], 0);
      top.push('Other');
      stats['Other'] = otherCount;
      labels = top;
    }

    const backgroundColors = labels.map(label => {
      if (explicitColors[label]) {
        return explicitColors[label];
      }
      // generate a random pastel color and remember it to keep consistency
      const rand = () => Math.floor((Math.random() * 127) + 64); // 64–191
      const color = `rgb(${rand()}, ${rand()}, ${rand()})`;
      explicitColors[label] = color;
      return color;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Logs by Type',
          data: labels.map(type => stats[type]),
          backgroundColor: backgroundColors,
          borderColor: '#1f2937',
          borderWidth: 2
        }
      ]
    };
  }

  getStatusCodeDistribution(logs: LogEntry[]): ChartData {
    const stats: StatusCodeStats = {};

    for (const log of logs) {
      if (log.statusCode) {
        stats[log.statusCode] = (stats[log.statusCode] || 0) + 1;
      }
    }

    const codes = Object.keys(stats)
      .map(code => parseInt(code))
      .sort((a, b) => stats[b] - stats[a])
      .slice(0, 10); // Top 10

    const colors = codes.map(code => {
      if (code >= 200 && code < 300) return '#10b981';
      if (code >= 300 && code < 400) return '#06b6d4';
      if (code >= 400 && code < 500) return '#f59e0b';
      if (code >= 500) return '#dc2626';
      return '#6b7280';
    });

    return {
      labels: codes.map(code => `${code}`),
      datasets: [
        {
          label: 'HTTP Status Codes',
          data: codes.map(code => stats[code]),
          backgroundColor: colors,
          borderColor: '#1f2937',
          borderWidth: 1
        }
      ]
    };
  }

  getTimelineData(logs: LogEntry[]): ChartData {
    const hourlyStats: { [hour: number]: number } = {};

    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = 0;
    }

    for (const log of logs) {
      hourlyStats[log.hour]++;
    }

    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const data = Array.from({ length: 24 }, (_, i) => hourlyStats[i]);

    return {
      labels,
      datasets: [
        {
          label: 'Logs Timeline',
          data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#1f2937'
        }
      ]
    };
  }

  getLevelsByHourTimeline(logs: LogEntry[]): ChartData {
    const levels = new Set(logs.map(log => log.level));
    const levelOrder = ['Critical', 'Error', 'Warning', 'Information', 'Debug', 'Trace'];
    const sortedLevels = Array.from(levels).sort((a, b) => {
      const aIdx = levelOrder.indexOf(a);
      const bIdx = levelOrder.indexOf(b);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    const colors = new Map<string, string>([
      ['Critical', '#dc2626'],
      ['Error', '#ef4444'],
      ['Warning', '#eab308'],
      ['Information', '#3b82f6'],
      ['Debug', '#9ca3af'],
      ['Trace', '#6b7280']
    ]);

    const datasets = sortedLevels.map(level => {
      const hourlyData: number[] = [];
      for (let hour = 0; hour < 24; hour++) {
        const count = logs.filter(log => log.hour === hour && log.level === level).length;
        hourlyData.push(count);
      }

      return {
        label: level,
        data: hourlyData,
        backgroundColor: colors.get(level) || '#6b7280',
        borderColor: '#1f2937',
        borderWidth: 1
      };
    });

    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    return {
      labels,
      datasets
    };
  }
}
