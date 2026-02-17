import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { LogsListComponent } from './components/logs-list/logs-list.component';
import { ChartComponent, ChartType } from './components/chart/chart.component';
import { LogParserService, LogEntry, LogStatistics, FilterItem } from './services/log-parser.service';
import { ChartStatsService, ChartData } from './services/chart-stats.service';

type ChartTab = 'hourly' | 'types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileUploadComponent,
    LogsListComponent,
    ChartComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild(FileUploadComponent) fileUpload!: FileUploadComponent;
  logs: LogEntry[] = [];
  stats: LogStatistics = { totalEntries: 0, entriesByHour: {} };
  pageSize = 500;
  peakHour = 0;
  peakEntries = 0;
  isLoading = false;
  loadingProgress = 0;

  // used to limit how often we redraw the chart while parsing
  private lastChartProgress = 0;
  private lastProcessedUpdate = 0; // track log count for periodic redraw

  availableLevels: FilterItem[] = [];
  availableTypes: FilterItem[] = [];

  // show hourly bar chart by default
  selectedChartTab: ChartTab = 'hourly';
  chartData: ChartData = {
    labels: [],
    datasets: []
  };
  chartType: ChartType = 'bar';

  // hourly bar and types tabs
  chartTabs: { id: ChartTab; label: string; type: ChartType }[] = [
    { id: 'hourly', label: 'Entries by Hour', type: 'bar' },
    { id: 'types', label: 'Log Types', type: 'doughnut' }
  ];

  constructor(private logParser: LogParserService, private chartStats: ChartStatsService, private router: Router) {}

  onFileLoaded(content: string) {
    this.isLoading = true;
    this.loadingProgress = 0;
    this.lastChartProgress = 0; // allow first live update

    this.logParser.parseLogFile(content).subscribe({
      next: (progress) => {
        this.logs = progress.logs;
        this.loadingProgress = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

        // Update available filters as logs come in
        const levelMap = new Map<string, { class: string; count: number }>();
        const typeMap = new Map<string, { class: string; count: number }>();

        for (const log of this.logs) {
          if (log.level && !levelMap.has(log.level)) {
            levelMap.set(log.level, { class: log.levelClass || 'bg-gray-800 text-gray-300 border-gray-700', count: 0 });
          }
          if (log.level) {
            const levelEntry = levelMap.get(log.level)!;
            levelEntry.count++;
          }

          if (log.type && !typeMap.has(log.type)) {
            typeMap.set(log.type, { class: log.typeClass || 'bg-gray-800 text-gray-300 border-gray-700', count: 0 });
          }
          if (log.type) {
            const typeEntry = typeMap.get(log.type)!;
            typeEntry.count++;
          }
        }

        this.availableLevels = Array.from(levelMap.entries()).map(([id, data]) => ({
          id,
          class: data.class,
          count: data.count
        }));

        this.availableTypes = Array.from(typeMap.entries()).map(([id, data]) => ({
          id,
          class: data.class,
          count: data.count
        }));

        // update numbers but postpone full redraw until parse complete
        this.updateStatistics(false);

        
      },
      error: (err) => {
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
        // now that parsing finished, compute stats/chart one last time
        this.updateStatistics(true);
      }
    });
  }

  onFileRemoved() {
    this.logs = [];
    this.stats = { totalEntries: 0, entriesByHour: {} };
    this.peakHour = 0;
    this.peakEntries = 0;
  }

  refreshLogs() {
    // Refresh is handled by re-parsing the logs already loaded
    this.updateStatistics();
    this.updateChart();
  }

  resetAndAskFile() {
    this.logs = [];
    this.stats = { totalEntries: 0, entriesByHour: {} };
    this.peakHour = 0;
    this.peakEntries = 0;
    this.availableLevels = [];
    this.availableTypes = [];
    this.chartData = { labels: [], datasets: [] };
    try {
      this.fileUpload?.removeFile();
      this.fileUpload?.openFileDialog();
    } catch (e) {
      // If ViewChild not available, ensure empty state is shown
    }
  }

  selectChartTab(tab: ChartTab) {
    this.selectedChartTab = tab;
    const selectedTab = this.chartTabs.find(t => t.id === tab);
    if (selectedTab) {
      this.chartType = selectedTab.type;
    }
    this.updateChart();
  }

  private updateChart() {
    if (this.logs.length === 0) return;

    switch (this.selectedChartTab) {
      case 'hourly':
        const hourlyLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
        const hourlyData = hourlyLabels.map((_, i) => this.stats.entriesByHour[i] || 0);
        this.chartData = {
          labels: hourlyLabels,
          datasets: [{
            label: 'Logs by Hour',
            data: hourlyData,
            backgroundColor: '#3b82f6',
            borderColor: '#3b82f6',
            borderWidth: 1
          }]
        };
        break;
      case 'types':
        this.chartData = this.chartStats.getTypeDistribution(this.logs);
        break;
    }
  }

  private updateStatistics(updateChart: boolean = true) {
    this.stats = this.logParser.getStatistics(this.logs);
    this.peakHour = this.getPeakHour();
    this.peakEntries = this.getPeakEntries();
    if (updateChart) {
      this.updateChart();
      // extra call in case chart component hasn't picked up the change yet
      setTimeout(() => this.updateChart(), 50);
    }
  }

  private getPeakHour(): number {
    let maxHour = 0;
    let maxCount = 0;
    for (let hour = 0; hour < 24; hour++) {
      if (this.stats.entriesByHour[hour] > maxCount) {
        maxCount = this.stats.entriesByHour[hour];
        maxHour = hour;
      }
    }
    return maxHour;
  }

  private getPeakEntries(): number {
    return Math.max(...Object.values(this.stats.entriesByHour));
  }
}
