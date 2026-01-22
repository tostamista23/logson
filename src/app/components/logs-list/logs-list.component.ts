import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterItem, LogEntry } from '../../services/log-parser.service';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-logs-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs-list.component.html'
})
export class LogsListComponent implements OnInit {
  @Input() logs: LogEntry[] = [];
  @Input() pageSize = 500;
  @Input() availableLevels: FilterItem[] = [];
  @Input() availableTypes: FilterItem[] = [];

  selectedLevels: string[] = [];
  selectedTypes: string[] = [];

  searchTerm = '';
  filteredLogs: LogEntry[] = [];
  currentPage = 1;
  totalPages = 1;
  paginatedLogs: LogEntry[] = [];
  startIndex = 0;
  endIndex = 0;
  
  showSqlModal = false;
  selectedSql = '';
  showUpdateNotification = false;
  newLogsCount = 0;

  private previousLogsCount = 0;
  private newLogIndices: Set<number> = new Set();

  ngOnInit() {
    this.previousLogsCount = this.logs.length;
    this.updatePagination();
  }

  ngOnChanges() {
    // Detect if new logs were added
    if (this.logs.length > this.previousLogsCount) {
      this.newLogsCount = this.logs.length - this.previousLogsCount;
      
      // Mark the new logs
      for (let i = this.previousLogsCount; i < this.logs.length; i++) {
        this.newLogIndices.add(i);
      }
      
      this.showUpdateNotification = true;
      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        this.showUpdateNotification = false;
      }, 5000);
    } else {
      // Clear new log markers if logs were removed or reloaded
      this.newLogIndices.clear();
    }
    
    this.previousLogsCount = this.logs.length;
    this.currentPage = 1;
    this.onSearchChange();
  }

  isNewLog(log: LogEntry): boolean {
    const index = this.logs.indexOf(log);
    return this.newLogIndices.has(index);
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilter();
    this.updatePagination();
  }

  clearSearch() {
    this.searchTerm = '';
    this.onSearchChange();
  }

  private applyFilter() {
    const searchLower = this.searchTerm.trim().toLowerCase();

    this.filteredLogs = this.logs.filter(log => {
      // Filtro por search term
      const matchesSearch =
        !searchLower ||
        log.message?.toLowerCase().includes(searchLower) ||
        log.formattedDate?.toLowerCase().includes(searchLower) ||
        (log.statusCode && log.statusCode.toString().includes(searchLower)) ||
        (log.httpMethod && log.httpMethod.toLowerCase().includes(searchLower)) ||
        (log.correlationId && log.correlationId.toLowerCase().includes(searchLower));

      // Filtro por levels (multi-select)
      const matchesLevel =
        this.selectedLevels.length === 0 || this.selectedLevels.includes(log.level);

      // Filtro por types (multi-select)
      const matchesType =
        this.selectedTypes.length === 0 || this.selectedTypes.includes(log.type);

      // Retorna apenas logs que passam todos os filtros
      return matchesSearch && matchesLevel && matchesType;
    });
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  private updatePagination() {
    this.totalPages = Math.ceil(this.filteredLogs.length / this.pageSize);
    this.startIndex = (this.currentPage - 1) * this.pageSize;
    this.endIndex = Math.min(this.startIndex + this.pageSize, this.filteredLogs.length);
    this.paginatedLogs = this.filteredLogs.slice(this.startIndex, this.endIndex);
  }

  getSqlWithHighlight(sql: string): SafeHtml {
    let highlighted = sql
      .replace(/<select>([\s\S]*?)<\/select>/g, '<span class="bg-blue-900 text-blue-200 px-1 rounded font-semibold">$1</span>')
      .replace(/<table>([\s\S]*?)<\/table>/g, '<span class="bg-purple-900 text-purple-200 px-1 rounded font-semibold">$1</span>')
      .replace(/<where>([\s\S]*?)<\/where>/g, '<span class="bg-indigo-900 text-indigo-200 px-1 rounded font-semibold">$1</span>')
      .replace(/<insert>([\s\S]*?)<\/insert>/g, '<span class="bg-green-900 text-green-200 px-1 rounded">$1</span>')
      .replace(/<update>([\s\S]*?)<\/update>/g, '<span class="bg-yellow-900 text-yellow-200 px-1 rounded">$1</span>')
      .replace(/<delete>([\s\S]*?)<\/delete>/g, '<span class="bg-red-900 text-red-200 px-1 rounded">$1</span>');
    
    return highlighted;
  }

  getCorrelationGroupClass(log: LogEntry): boolean {
    if (!log.correlationId) return false;
    
    const currentIndex = this.paginatedLogs.indexOf(log);
    if (currentIndex === -1) return false;
    
    const prevLog = currentIndex > 0 ? this.paginatedLogs[currentIndex - 1] : null;
    const nextLog = currentIndex < this.paginatedLogs.length - 1 ? this.paginatedLogs[currentIndex + 1] : null;
    
    const hasPrevMatch = prevLog ? prevLog.correlationId === log.correlationId : false;
    const hasNextMatch = nextLog ? nextLog.correlationId === log.correlationId : false;
    
    return hasPrevMatch || hasNextMatch;
  }

  getConnectorClass(log: LogEntry, index: number): string {
    if (!log.correlationId) return '';
    
    const prevLog = index > 0 ? this.paginatedLogs[index - 1] : null;
    const nextLog = index < this.paginatedLogs.length - 1 ? this.paginatedLogs[index + 1] : null;
    
    const hasPrevMatch = prevLog && prevLog.correlationId === log.correlationId;
    const hasNextMatch = nextLog && nextLog.correlationId === log.correlationId;
    
    if (hasPrevMatch && hasNextMatch) {
      return 'connector-middle';
    } else if (hasPrevMatch && !hasNextMatch) {
      return 'connector-end';
    } else if (!hasPrevMatch && hasNextMatch) {
      return 'connector-start';
    }
    
    return '';
  }

  getCorrelationColor(correlationId: string | undefined): string {
    if (!correlationId) return 'bg-gray-500';
    
    let hash = 0;
    for (let i = 0; i < correlationId.length; i++) {
      hash = ((hash << 5) - hash) + correlationId.charCodeAt(i);
      hash = hash & hash;
    }
    
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-cyan-500'
    ];
    
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  }

  openSqlModal(sql: string) {
    this.selectedSql = sql;
    this.showSqlModal = true;
  }

  closeSqlModal() {
    this.showSqlModal = false;
    this.selectedSql = '';
  }

  
  isLevelSelected(level: string): boolean {
    return this.selectedLevels.includes(level);
  }

  isTypeSelected(type: string): boolean {
    return this.selectedTypes.includes(type);
  }

  toggleLevel(level: string) {
    const index = this.selectedLevels.indexOf(level);
    if (index >= 0) {
      this.selectedLevels.splice(index, 1);
    } else {
      this.selectedLevels.push(level);
    }

    this.applyFilter()
    this.updatePagination();

  }

  toggleType(type: string) {
    const index = this.selectedTypes.indexOf(type);
    if (index >= 0) {
      this.selectedTypes.splice(index, 1);
    } else {
      this.selectedTypes.push(type);
    }

    this.applyFilter()
    this.updatePagination();
  }
}
