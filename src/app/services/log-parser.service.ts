import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LogEntry {
  timestamp: string;
  formattedDate: string;
  hour: number;
  data: any;
  raw: string;
  type: string;
  typeClass: string;
  level: string;
  levelClass: string;
  message: string;
  statusCode?: number;
  statusCodeClass?: string;
  httpMethod?: string;
  httpMethodClass?: string;
  correlationId?: string;
  sql?: string;
  sqlFormatted?: string;
  requestPath?: string;
}

export interface LogStatistics {
  totalEntries: number;
  entriesByHour: { [key: number]: number };
}

export interface FilterItem {
  id: string;
  class: string;
}

interface ParsingProgress {
  processed: number;
  total: number;
  logs: LogEntry[];
}

@Injectable({
  providedIn: 'root'
})
export class LogParserService {
  private worker: Worker | null = null;
  private parsingProgress$ = new BehaviorSubject<ParsingProgress>({ processed: 0, total: 0, logs: [] });
  private dateCache = new Map<string, string>();
  private readonly CHUNK_SIZE = 5000; // Process 5000 lines at a time
  private readonly DATE_CACHE_MAX = 10000; // Max cached dates

  // Style caches - static maps for O(1) lookup
  private readonly TYPE_STYLES_MAP = new Map<string, string>([
    ['Database', 'bg-blue-900 text-blue-200 border border-blue-700'],
    ['HTTP', 'bg-green-900 text-green-200 border border-green-700'],
    ['Error', 'bg-red-900 text-red-200 border border-red-700'],
    ['Warning', 'bg-yellow-900 text-yellow-200 border border-yellow-700'],
    ['ORM', 'bg-purple-900 text-purple-200 border border-purple-700'],
    ['Migration', 'bg-indigo-900 text-indigo-200 border border-indigo-700'],
    ['App', 'bg-cyan-900 text-cyan-200 border border-cyan-700'],
    ['Security', 'bg-orange-900 text-orange-200 border border-orange-700'],
    ['Validation', 'bg-pink-900 text-pink-200 border border-pink-700'],
    ['Static', 'bg-gray-700 text-gray-200 border border-gray-600'],
    ['Log', 'bg-gray-700 text-gray-200 border border-gray-600']
  ]);

  private readonly LEVEL_STYLES_MAP = new Map<string, string>([
    ['Error', 'bg-red-900 text-red-200 border border-red-700'],
    ['Warning', 'bg-yellow-900 text-yellow-200 border border-yellow-700'],
    ['Information', 'bg-blue-900 text-blue-200 border border-blue-700'],
    ['Debug', 'bg-gray-700 text-gray-300 border border-gray-600'],
    ['Trace', 'bg-gray-700 text-gray-300 border border-gray-600'],
    ['Critical', 'bg-red-900 text-red-200 border border-red-700']
  ]);

  private readonly HTTP_METHOD_STYLES_MAP = new Map<string, string>([
    ['GET', 'bg-blue-900 text-blue-200 border border-blue-700'],
    ['POST', 'bg-green-900 text-green-200 border border-green-700'],
    ['PUT', 'bg-yellow-900 text-yellow-200 border border-yellow-700'],
    ['PATCH', 'bg-purple-900 text-purple-200 border border-purple-700'],
    ['DELETE', 'bg-red-900 text-red-200 border border-red-700'],
    ['HEAD', 'bg-gray-700 text-gray-200 border border-gray-600'],
    ['OPTIONS', 'bg-gray-700 text-gray-200 border border-gray-600']
  ]);

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/log-parser.worker', import.meta.url), { type: 'module' });
        this.worker.onmessage = ({ data }) => {
          this.parsingProgress$.next(data);
        };
      } catch (e) {
        console.warn('WebWorker not supported, falling back to main thread parsing');
        this.worker = null;
      }
    }
  }

  parseLogFile(content: string): Observable<ParsingProgress> {
    if (this.worker) {
      // Use WebWorker for parsing
      return new Observable(observer => {
        // Reset progress for new parse
        this.parsingProgress$.next({ processed: 0, total: 0, logs: [] });

        let completed = false;
        let lastProgress: ParsingProgress | null = null;
        
        // Safety timeout - if no completion after 30s, force complete
        const timeoutId = setTimeout(() => {
          if (!completed && lastProgress) {
            console.warn('Parse timeout - forcing completion');
            completed = true;
            observer.complete();
            subscription.unsubscribe();
          }
        }, 30000);

        const subscription = this.parsingProgress$.subscribe(progress => {
          observer.next(progress);
          lastProgress = progress;
          // Complete when total > 0 and processed >= total
          if (progress.total > 0 && progress.processed >= progress.total && !completed) {
            completed = true;
            clearTimeout(timeoutId);
            observer.complete();
            subscription.unsubscribe();
          }
        });

        this.worker!.postMessage({
          type: 'PARSE_LOG',
          content,
          chunkSize: this.CHUNK_SIZE
        });

        return () => {
          clearTimeout(timeoutId);
          subscription.unsubscribe();
        };
      });
    } else {
      // Fallback: parse in chunks on main thread
      return new Observable(observer => {
        setTimeout(() => {
          const logs = this.parseLogFileChunked(content);
          observer.next({ processed: logs.length, total: logs.length, logs });
          observer.complete();
        }, 0);
      });
    }
  }

  private parseLogFileChunked(content: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = content.split('\n');
    const total = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        let data: any;
        try {
          data = JSON.parse(line);
        } catch (e) {
          data = this.parseTextLogLine(line);
          if (!data) continue;
        }

        const timestamp = data.Timestamp || data.timestamp || new Date().toISOString();
        const date = new Date(timestamp);
        const hour = date.getHours();

        const type = this.detectLogType(data);
        const typeClass = this.getTypeStyles(type);
        const level = data.Level || 'Information';
        const levelClass = this.getLevelStyles(level);
        const message = this.formatMessage(data.MessageTemplate || data.Message, data.Properties);

        let statusCode: number | undefined;
        let statusCodeClass: string | undefined;
        let httpMethod: string | undefined;
        let httpMethodClass: string | undefined;

        const props = data.Properties || {};

        statusCode = props.StatusCode || undefined;
        if (statusCode) {
          statusCodeClass = this.getStatusCodeStyles(statusCode);
        }

        if (type === 'HTTP') {
          httpMethod = props.Method || undefined;
          if (httpMethod) {
            httpMethodClass = this.getHttpMethodStyles(httpMethod);
          }
        }

        const correlationId = props.RequestId || props.TraceId || props.CorrelationId || props.CorrelationIdentifier || undefined;

        let sql: string | undefined;
        let sqlFormatted: string | undefined;
        let requestPath: string | undefined;
        if (type === 'Database') {
          sql = props.CommandText || message;
          if (sql) {
            sqlFormatted = this.formatSql(sql);
          }
          requestPath = props.RequestPath || undefined;
        }

        logs.push({
          timestamp,
          formattedDate: this.formatDate(timestamp),
          hour,
          data,
          raw: line,
          type,
          typeClass,
          level,
          levelClass,
          message,
          statusCode,
          statusCodeClass,
          httpMethod,
          httpMethodClass,
          correlationId,
          sql,
          sqlFormatted,
          requestPath
        });

        // Report progress every chunk
        if (i % this.CHUNK_SIZE === 0) {
          this.parsingProgress$.next({ processed: i, total, logs });
        }
      } catch (e) {
        // Skip invalid lines
      }
    }

    // Sort only once at the end
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.parsingProgress$.next({ processed: total, total, logs });

    return logs;
  }

  getStatistics(logs: LogEntry[]): LogStatistics {
    const entriesByHour: { [key: number]: number } = {};

    for (let i = 0; i < 24; i++) {
      entriesByHour[i] = 0;
    }

    for (const log of logs) {
      entriesByHour[log.hour]++;
    }

    return {
      totalEntries: logs.length,
      entriesByHour
    };
  }

  private detectLogType(data: any): string {
    const sourceContext = data.Properties?.SourceContext || data.SourceContext || '';
    
    if (sourceContext.includes('EntityFrameworkCore.Database')) {
      return 'Database';
    }
    if (sourceContext.includes('EntityFrameworkCore.Migrations')) {
      return 'Migration';
    }
    if (sourceContext.includes('EntityFrameworkCore')) {
      return 'ORM';
    }
    if (sourceContext.includes('AspNetCore.Hosting.Diagnostics') || 
        sourceContext.includes('AspNetCore.Routing') ||
        sourceContext.includes('AspNetCore.Mvc')) {
      return 'HTTP';
    }
    if (sourceContext.includes('DataProtection')) {
      return 'Security';
    }
    if (sourceContext.includes('StaticFiles')) {
      return 'Static';
    }
    if (sourceContext.includes('Lifetime')) {
      return 'App';
    }
    if (sourceContext.includes('Validation')) {
      return 'Validation';
    }
    
    if (data.Level === 'Error') {
      return 'Error';
    }
    if (data.Level === 'Warning') {
      return 'Warning';
    }
    
    return 'Log';
  }

  

  private formatDate(timestamp: string): string {
    // Check cache first
    if (this.dateCache.has(timestamp)) {
      return this.dateCache.get(timestamp)!;
    }

    try {
      const date = new Date(timestamp);
      const formatted = date.toLocaleString('pt-PT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Cache the result
      if (this.dateCache.size < this.DATE_CACHE_MAX) {
        this.dateCache.set(timestamp, formatted);
      }

      return formatted;
    } catch {
      return timestamp;
    }
  }

  private getTypeStyles(type: string): string {
    return this.TYPE_STYLES_MAP.get(type) || this.TYPE_STYLES_MAP.get('Log') || '';
  }

  private getLevelStyles(level: string): string {
    return this.LEVEL_STYLES_MAP.get(level) || 'bg-gray-700 text-gray-200 border border-gray-600';
  }

  private formatMessage(template: string | undefined, properties: any): string {
    if (!template) return 'N/A';
    
    let message = template;
    
    if (properties && typeof properties === 'object') {
      // Substitui placeholders como {elapsed}, {property}, {entityType}, etc
      Object.keys(properties).forEach(key => {
        const placeholder = `{${key}}`;
        const value = properties[key];
        
        // Se for um objeto, tenta obter uma representação simples
        let stringValue = value;
        if (typeof value === 'object' && value !== null) {
          if (value.Name) {
            stringValue = value.Name;
          } else if (value.toString && value.toString() !== '[object Object]') {
            stringValue = value.toString();
          } else {
            stringValue = JSON.stringify(value);
          }
        }
        
        message = message.replace(new RegExp(placeholder, 'g'), stringValue);
      });
    }
    
    return message;
  }

  private getStatusCodeStyles(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      // 2xx - Success
      return 'bg-green-900 text-green-200 border border-green-700';
    } else if (statusCode >= 300 && statusCode < 400) {
      // 3xx - Redirect
      return 'bg-cyan-900 text-cyan-200 border border-cyan-700';
    } else if (statusCode >= 400 && statusCode < 500) {
      // 4xx - Client Error
      return 'bg-yellow-900 text-yellow-200 border border-yellow-700';
    } else if (statusCode >= 500) {
      // 5xx - Server Error
      return 'bg-red-900 text-red-200 border border-red-700';
    }
    return 'bg-gray-700 text-gray-200 border border-gray-600';
  }

  private getHttpMethodStyles(method: string): string {
    const methodUpper = method.toUpperCase();
    return this.HTTP_METHOD_STYLES_MAP.get(methodUpper) || 'bg-gray-700 text-gray-200 border border-gray-600';
  }

  private formatSql(sql: string): string {
    if (!sql) return sql;
    
    // Remove parameters info at the beginning
    sql = sql.replace(/^Executed DbCommand.*?\]/s, '').trim();
    
    // Extract main operation type
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
    const fromMatch = sql.match(/FROM\s+\[?(?:dbo|[^\]]*)\]?\.\[?([^\]]+)\]?/i);
    
    // Improve WHERE clause extraction - capture everything after WHERE until end or ORDER/GROUP/LIMIT
    let whereMatch = null;
    const whereIndex = sql.toUpperCase().indexOf('WHERE');
    if (whereIndex !== -1) {
      let endIndex = sql.length;
      const orderIndex = sql.toUpperCase().indexOf('ORDER BY', whereIndex);
      const groupIndex = sql.toUpperCase().indexOf('GROUP BY', whereIndex);
      const limitIndex = sql.toUpperCase().indexOf('LIMIT', whereIndex);
      
      if (orderIndex !== -1) endIndex = Math.min(endIndex, orderIndex);
      if (groupIndex !== -1) endIndex = Math.min(endIndex, groupIndex);
      if (limitIndex !== -1) endIndex = Math.min(endIndex, limitIndex);
      
      const whereClauseText = sql.substring(whereIndex + 5, endIndex).trim();
      whereMatch = [sql, whereClauseText];
    }
    
    const insertMatch = sql.match(/INSERT\s+INTO\s+\[?([^\]]+)\]?/i);
    const updateMatch = sql.match(/UPDATE\s+\[?([^\]]+)\]?/i);
    const deleteMatch = sql.match(/DELETE\s+FROM\s+\[?([^\]]+)\]?/i);
    
    let summary = '';
    
    if (selectMatch) {
      const columns = selectMatch[1].split(',').length;
      const tableName = fromMatch ? fromMatch[1].replace(/[\[\]]/g, '') : 'Unknown';
      summary += `<select>SELECT ${columns} cols</select> FROM <table>${tableName}</table>`;
      
      if (whereMatch) {
        const whereClause = whereMatch[1].replace(/[\[\]]/g, '').trim();
        summary += ` <where>WHERE ${whereClause}</where>`;
      }
    } else if (insertMatch) {
      const tableName = insertMatch[1].replace(/[\[\]]/g, '');
      summary = `<insert>INSERT INTO</insert> <table>${tableName}</table>`;
    } else if (updateMatch) {
      const tableName = updateMatch[1].replace(/[\[\]]/g, '');
      summary = `<update>UPDATE</update> <table>${tableName}</table>`;
      if (whereMatch) {
        const whereClause = whereMatch[1].replace(/[\[\]]/g, '').trim();
        summary += ` <where>WHERE ${whereClause}</where>`;
      }
    } else if (deleteMatch) {
      const tableName = deleteMatch[1].replace(/[\[\]]/g, '');
      summary = `<delete>DELETE FROM</delete> <table>${tableName}</table>`;
      if (whereMatch) {
        const whereClause = whereMatch[1].trim().replace(/[\[\]]/g, '');
        summary += ` <where>WHERE ${whereClause}</where>`;
      }
    } else {
      summary = sql.substring(0, 80) + '...';
    }
    
    return summary;
  }





  private parseTextLogLine(line: string): any | null {
    // Exemplo:
    // 2026-01-20 09:54:15.474 +00:00 [WRN] Message...

    const regex = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+([+-]\d{2}:\d{2})\s+\[?(\w+)\]?\s+([\s\S]*)$/;
    const match = line.match(regex);

    if (!match) return null;

    const [, date, time, offset, level, message] = match;

    const timestamp = `${date}T${time}${offset}`;

    let sourceContext = this.getSourceContext(message);
    return {
      Timestamp: timestamp,
      Level: this.mapLogLevel(level),
      SourceContext: sourceContext,
      Message: message,
      Properties: { 
        StatusCode: sourceContext == "AspNetCore.Routing" ? this.extractHttpStatus(message) : undefined,
        Method: this.extractHttpMethod(message)
      },
    };
  }

  extractHttpStatus(line: string): number | null {
    // Regex: procura - <código> - 
    // Ex: "- 400 -" ou "- 200 -"
    const match = line.match(/-\s*(\d{3})\s*-/);
    if (match) {
      const code = parseInt(match[1], 10);
      if (code >= 200 && code <= 500) {
        return code;
      }
    }
    return null;
  }

  extractHttpMethod(line: string): string | null {
    const methodMatch = line.match(/\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b/);
    if (methodMatch) {
      return methodMatch[1];
    }
    return null;
  }


  getSourceContext(message: string): string {
    return message.startsWith('Executed DbCommand') ? 'EntityFrameworkCore.Database' : 
      message.startsWith('Request starting') ? 'AspNetCore.Routing' :
      message.startsWith('Request finished') ? 'AspNetCore.Routing' :
      message.startsWith('Executing endpoint') ? 'AspNetCore.Routing' : "";
  }

  private mapLogLevel(level: string): string {
    switch (level) {
      case 'WRN': return 'Warning';
      case 'ERR': return 'Error';
      case 'INF': return 'Information';
      case 'DBG': return 'Debug';
      case 'FTL': return 'Fatal';
      default: return level;
    }
  }
}