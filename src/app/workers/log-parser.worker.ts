// Log parser WebWorker - runs in separate thread for non-blocking UI
interface WorkerLogEntry {
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

interface ParsingMessage {
  type: string;
  content?: string;
  chunkSize?: number;
}

// Style caches
const TYPE_STYLES_MAP = new Map<string, string>([
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

const LEVEL_STYLES_MAP = new Map<string, string>([
  ['Error', 'bg-red-900 text-red-200 border border-red-700'],
  ['Warning', 'bg-yellow-900 text-yellow-200 border border-yellow-700'],
  ['Information', 'bg-blue-900 text-blue-200 border border-blue-700'],
  ['Debug', 'bg-gray-700 text-gray-300 border border-gray-600'],
  ['Trace', 'bg-gray-700 text-gray-300 border border-gray-600'],
  ['Critical', 'bg-red-900 text-red-200 border border-red-700']
]);

const HTTP_METHOD_STYLES_MAP = new Map<string, string>([
  ['GET', 'bg-blue-900 text-blue-200 border border-blue-700'],
  ['POST', 'bg-green-900 text-green-200 border border-green-700'],
  ['PUT', 'bg-yellow-900 text-yellow-200 border border-yellow-700'],
  ['PATCH', 'bg-purple-900 text-purple-200 border border-purple-700'],
  ['DELETE', 'bg-red-900 text-red-200 border border-red-700'],
  ['HEAD', 'bg-gray-700 text-gray-200 border border-gray-600'],
  ['OPTIONS', 'bg-gray-700 text-gray-200 border border-gray-600']
]);

const dateCache = new Map<string, string>();
const DATE_CACHE_MAX = 10000;

function formatDate(timestamp: string): string {
  if (dateCache.has(timestamp)) {
    return dateCache.get(timestamp)!;
  }

  try {
    const date = new Date(timestamp);
    // Format: YYYY-MM-DD HH:mm:ss (Portuguese locale)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    const formatted = `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;

    if (dateCache.size < DATE_CACHE_MAX) {
      dateCache.set(timestamp, formatted);
    }

    return formatted;
  } catch {
    return timestamp;
  }
}

function getTypeStyles(type: string): string {
  return TYPE_STYLES_MAP.get(type) || TYPE_STYLES_MAP.get('Log') || '';
}

function getLevelStyles(level: string): string {
  return LEVEL_STYLES_MAP.get(level) || 'bg-gray-700 text-gray-200 border border-gray-600';
}

function getStatusCodeStyles(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return 'bg-green-900 text-green-200 border border-green-700';
  } else if (statusCode >= 300 && statusCode < 400) {
    return 'bg-cyan-900 text-cyan-200 border border-cyan-700';
  } else if (statusCode >= 400 && statusCode < 500) {
    return 'bg-yellow-900 text-yellow-200 border border-yellow-700';
  } else if (statusCode >= 500) {
    return 'bg-red-900 text-red-200 border border-red-700';
  }
  return 'bg-gray-700 text-gray-200 border border-gray-600';
}

function getHttpMethodStyles(method: string): string {
  const methodUpper = method.toUpperCase();
  return HTTP_METHOD_STYLES_MAP.get(methodUpper) || 'bg-gray-700 text-gray-200 border border-gray-600';
}

function detectLogType(data: any): string {
  const sourceContext = data.Properties?.SourceContext || data.SourceContext || '';

  if (sourceContext.includes('EntityFrameworkCore.Database')) return 'Database';
  if (sourceContext.includes('EntityFrameworkCore.Migrations')) return 'Migration';
  if (sourceContext.includes('EntityFrameworkCore')) return 'ORM';
  if (sourceContext.includes('AspNetCore.Hosting.Diagnostics') ||
    sourceContext.includes('AspNetCore.Routing') ||
    sourceContext.includes('AspNetCore.Mvc')) return 'HTTP';
  if (sourceContext.includes('DataProtection')) return 'Security';
  if (sourceContext.includes('StaticFiles')) return 'Static';
  if (sourceContext.includes('Lifetime')) return 'App';
  if (sourceContext.includes('Validation')) return 'Validation';

  if (data.Level === 'Error') return 'Error';
  if (data.Level === 'Warning') return 'Warning';

  return 'Log';
}

function formatMessage(template: string | undefined, properties: any): string {
  if (!template) return 'N/A';

  let message = template;

  if (properties && typeof properties === 'object') {
    Object.keys(properties).forEach(key => {
      const placeholder = `{${key}}`;
      const value = properties[key];

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

function formatSql(sql: string): string {
  if (!sql) return sql;

  sql = sql.replace(/^Executed DbCommand.*?\]/s, '').trim();

  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
  const fromMatch = sql.match(/FROM\s+\[?(?:dbo|[^\]]*)\]?\.\[?([^\]]+)\]?/i);

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

function parseTextLogLine(line: string): any | null {
  const regex = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+([+-]\d{2}:\d{2})\s+\[?(\w+)\]?\s+([\s\S]*)$/;
  const match = line.match(regex);

  if (!match) return null;

  const [, date, time, offset, level, message] = match;
  const timestamp = `${date}T${time}${offset}`;
  let sourceContext = getSourceContextFromMessage(message);

  return {
    Timestamp: timestamp,
    Level: mapLogLevel(level),
    SourceContext: sourceContext,
    Message: message,
    Properties: {
      StatusCode: sourceContext === 'AspNetCore.Routing' ? extractHttpStatus(message) : undefined,
      Method: extractHttpMethod(message)
    }
  };
}

function getSourceContextFromMessage(message: string): string {
  return message.startsWith('Executed DbCommand') ? 'EntityFrameworkCore.Database' :
    message.startsWith('Request starting') ? 'AspNetCore.Routing' :
    message.startsWith('Request finished') ? 'AspNetCore.Routing' :
      message.startsWith('Executing endpoint') ? 'AspNetCore.Routing' : '';
}

function extractHttpStatus(line: string): number | null {
  const match = line.match(/-\s*(\d{3})\s*-/);
  if (match) {
    const code = parseInt(match[1], 10);
    if (code >= 200 && code <= 500) {
      return code;
    }
  }
  return null;
}

function extractHttpMethod(line: string): string | null {
  const methodMatch = line.match(/\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b/);
  return methodMatch ? methodMatch[1] : null;
}

function mapLogLevel(level: string): string {
  switch (level) {
    case 'WRN': return 'Warning';
    case 'ERR': return 'Error';
    case 'INF': return 'Information';
    case 'DBG': return 'Debug';
    case 'FTL': return 'Fatal';
    default: return level;
  }
}

function parseLogFile(content: string, chunkSize: number): void {
  const logs: WorkerLogEntry[] = [];
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
        data = parseTextLogLine(line);
        if (!data) continue;
      }

      const timestamp = data.Timestamp || data.timestamp || new Date().toISOString();
      const date = new Date(timestamp);
      const hour = date.getHours();

      const type = detectLogType(data);
      const typeClass = getTypeStyles(type);
      const level = data.Level || 'Information';
      const levelClass = getLevelStyles(level);
      const message = formatMessage(data.MessageTemplate || data.Message, data.Properties);

      let statusCode: number | undefined;
      let statusCodeClass: string | undefined;
      let httpMethod: string | undefined;
      let httpMethodClass: string | undefined;

      const props = data.Properties || {};

      statusCode = props.StatusCode || undefined;
      if (statusCode) {
        statusCodeClass = getStatusCodeStyles(statusCode);
      }

      if (type === 'HTTP') {
        httpMethod = props.Method || undefined;
        if (httpMethod) {
          httpMethodClass = getHttpMethodStyles(httpMethod);
        }
      }

      const correlationId = props.RequestId || props.TraceId || props.CorrelationId || props.CorrelationIdentifier || undefined;

      let sql: string | undefined;
      let sqlFormatted: string | undefined;
      let requestPath: string | undefined;
      if (type === 'Database') {
        sql = props.CommandText || message;
        if (sql) {
          sqlFormatted = formatSql(sql);
        }
        requestPath = props.RequestPath || undefined;
      }

      logs.push({
        timestamp,
        formattedDate: formatDate(timestamp),
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
      if (i % chunkSize === 0) {
        self.postMessage({
          processed: i,
          total,
          logs: logs.slice()
        });
      }
    } catch (e) {
      // Skip invalid lines
    }
  }

  // Sort only once at the end
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Final message with complete result
  self.postMessage({
    processed: total,
    total,
    logs
  });
}

// Listen for messages from main thread
self.onmessage = (event: MessageEvent<ParsingMessage>) => {
  const { type, content, chunkSize } = event.data;

  if (type === 'PARSE_LOG' && content) {
    parseLogFile(content, chunkSize || 5000);
  }
};
