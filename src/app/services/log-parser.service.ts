import { Injectable } from '@angular/core';

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

@Injectable({
  providedIn: 'root'
})
export class LogParserService {

  parseLogFile(content: string): LogEntry[] {
    const logs: LogEntry[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const data = JSON.parse(line);
        const timestamp = data.Timestamp || data.timestamp || new Date().toISOString();
        const date = new Date(timestamp);
        const hour = date.getHours();

        const type = this.detectLogType(data);
        const typeClass = this.getTypeStyles(type);
        const level = data.Level || 'Information';
        const levelClass = this.getLevelStyles(level);
        const message = this.formatMessage(data.MessageTemplate, data.Properties);
        
        let statusCode: number | undefined;
        let statusCodeClass: string | undefined;
        let httpMethod: string | undefined;
        let httpMethodClass: string | undefined;
        
        const props = data.Properties || {};
        
        // Extract statusCode from any log type
        statusCode = props.StatusCode || undefined;
        if (statusCode) {
          statusCodeClass = this.getStatusCodeStyles(statusCode);
        }
        
        // Extract HTTP method only from HTTP logs
        if (type === 'HTTP') {
          httpMethod = props.Method || undefined;
          if (httpMethod) {
            httpMethodClass = this.getHttpMethodStyles(httpMethod);
          }
        }
        
        // Extract correlation ID (try multiple field names)
        const correlationId = props.RequestId || props.TraceId || props.CorrelationId || props.CorrelationIdentifier || undefined;
        
        // Extract and format SQL for Database logs
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
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('pt-PT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  }

  private getTypeStyles(type: string): string {
    const styles: { [key: string]: string } = {
      'Database': 'bg-blue-900 text-blue-200 border border-blue-700',
      'HTTP': 'bg-green-900 text-green-200 border border-green-700',
      'Error': 'bg-red-900 text-red-200 border border-red-700',
      'Warning': 'bg-yellow-900 text-yellow-200 border border-yellow-700',
      'ORM': 'bg-purple-900 text-purple-200 border border-purple-700',
      'Migration': 'bg-indigo-900 text-indigo-200 border border-indigo-700',
      'App': 'bg-cyan-900 text-cyan-200 border border-cyan-700',
      'Security': 'bg-orange-900 text-orange-200 border border-orange-700',
      'Validation': 'bg-pink-900 text-pink-200 border border-pink-700',
      'Static': 'bg-gray-700 text-gray-200 border border-gray-600',
      'Log': 'bg-gray-700 text-gray-200 border border-gray-600'
    };
    return styles[type] || styles['Log'];
  }

  private getLevelStyles(level: string): string {
    const styles: { [key: string]: string } = {
      'Error': 'bg-red-900 text-red-200 border border-red-700',
      'Warning': 'bg-yellow-900 text-yellow-200 border border-yellow-700',
      'Information': 'bg-blue-900 text-blue-200 border border-blue-700',
      'Debug': 'bg-gray-700 text-gray-300 border border-gray-600',
      'Trace': 'bg-gray-700 text-gray-300 border border-gray-600',
      'Critical': 'bg-red-900 text-red-200 border border-red-700'
    };
    return styles[level] || 'bg-gray-700 text-gray-200 border border-gray-600';
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
    const styles: { [key: string]: string } = {
      'GET': 'bg-blue-900 text-blue-200 border border-blue-700',
      'POST': 'bg-green-900 text-green-200 border border-green-700',
      'PUT': 'bg-yellow-900 text-yellow-200 border border-yellow-700',
      'PATCH': 'bg-purple-900 text-purple-200 border border-purple-700',
      'DELETE': 'bg-red-900 text-red-200 border border-red-700',
      'HEAD': 'bg-gray-700 text-gray-200 border border-gray-600',
      'OPTIONS': 'bg-gray-700 text-gray-200 border border-gray-600'
    };
    return styles[methodUpper] || 'bg-gray-700 text-gray-200 border border-gray-600';
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
}