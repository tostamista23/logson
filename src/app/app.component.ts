import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { BarChartComponent } from './components/bar-chart/bar-chart.component';
import { LogsListComponent } from './components/logs-list/logs-list.component';
import { LogParserService, LogEntry, LogStatistics, FilterItem } from './services/log-parser.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FileUploadComponent,
    BarChartComponent,
    LogsListComponent
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

  availableLevels: FilterItem[] = [];
  availableTypes: FilterItem[] = [];

  constructor(private logParser: LogParserService, private router: Router) {}

  onFileLoaded(content: string) {
    this.logs = this.logParser.parseLogFile(content);

    const levelMap = new Map<string, string>();
    const typeMap = new Map<string, string>();

    for (const log of this.logs) {
      if (log.level && !levelMap.has(log.level)) {
        levelMap.set(log.level, log.levelClass || 'bg-gray-800 text-gray-300 border-gray-700');
      }

      if (log.type && !typeMap.has(log.type)) {
        typeMap.set(log.type, log.typeClass || 'bg-gray-800 text-gray-300 border-gray-700');
      }
    }

    this.availableLevels = Array.from(levelMap.entries()).map(([id, cls]) => ({
      id,
      class: cls
    }))

    this.availableTypes = Array.from(typeMap.entries()).map(([id, cls]) => ({
      id,
      class: cls
    }))

    this.updateStatistics();
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
  }

  resetAndAskFile() {
    this.logs = [];
    this.stats = { totalEntries: 0, entriesByHour: {} };
    this.peakHour = 0;
    this.peakEntries = 0;
    this.availableLevels = [];
    this.availableTypes = [];
    try {
      this.fileUpload?.removeFile();
      this.fileUpload?.openFileDialog();
    } catch (e) {
      // If ViewChild not available, ensure empty state is shown
    }
  }

  private updateStatistics() {
    this.stats = this.logParser.getStatistics(this.logs);
    this.peakHour = this.getPeakHour();
    this.peakEntries = this.getPeakEntries();
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
