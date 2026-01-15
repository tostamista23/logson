import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { BarChartComponent } from './components/bar-chart/bar-chart.component';
import { LogsListComponent } from './components/logs-list/logs-list.component';
import { LogParserService, LogEntry, LogStatistics } from './services/log-parser.service';

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
  template: `
    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div class="max-w-7xl mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-4xl font-bold text-white mb-2">Logson</h1>
          <p class="text-gray-400">JSON Structured Logs Viewer</p>
        </div>

        <!-- File Upload Section -->
        <div class="mb-8">
          <app-file-upload (onFileLoaded)="onFileLoaded($event)" (onFileRemoved)="onFileRemoved()"></app-file-upload>
        </div>

        <!-- Content -->
        <div *ngIf="logs.length > 0" class="space-y-8">
          <!-- Chart with Statistics Section -->
          <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 class="text-xl font-bold text-white mb-6">Entries by Hour</h2>
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <!-- Statistics Sidebar -->
              <div class="space-y-4">
                <div class="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <p class="text-gray-400 text-xs uppercase tracking-wide mb-2">Total Entries</p>
                  <p class="text-2xl font-bold text-blue-400">{{ stats.totalEntries }}</p>
                </div>
                <div class="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <p class="text-gray-400 text-xs uppercase tracking-wide mb-2">Peak Hour</p>
                  <p class="text-2xl font-bold text-green-400">{{ peakHour }}:00</p>
                </div>
                <div class="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <p class="text-gray-400 text-xs uppercase tracking-wide mb-2">Peak Entries</p>
                  <p class="text-2xl font-bold text-purple-400">{{ peakEntries }}</p>
                </div>
              </div>
              <!-- Chart -->
              <div class="lg:col-span-3">
                <app-bar-chart [data]="stats.entriesByHour"></app-bar-chart>
              </div>
            </div>
          </div>

          <!-- Logs List -->
          <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-white">Log Entries</h2>
              <button 
                (click)="refreshLogs()"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                TODO: Refresh Logs
              </button>
            </div>
            <app-logs-list [logs]="logs" [pageSize]="pageSize"></app-logs-list>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="logs.length === 0" class="text-center py-16">
          <p class="text-gray-400 text-lg">Upload a .log file to get started</p>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AppComponent {
  logs: LogEntry[] = [];
  stats: LogStatistics = { totalEntries: 0, entriesByHour: {} };
  pageSize = 500;
  peakHour = 0;
  peakEntries = 0;

  constructor(private logParser: LogParserService) {}

  onFileLoaded(content: string) {
    this.logs = this.logParser.parseLogFile(content);
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
