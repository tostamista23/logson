# Logson

Logson is a lightweight, browser-first viewer for JSON-structured logs (NDJSON / newline-delimited JSON). It lets you upload .log files, explore entries, filter, and visualise simple statistics.

## Features

- Upload a `.log` file (NDJSON) via file picker or drag-and-drop
- Fast parsing and presentation of structured JSON logs
- Entries-by-hour bar chart and basic statistics
- Advanced filtering:
	- Full-text search
	- Regex filtering
	- Level and type multi-select
	- Time range filtering (start and end time)
- SQL summarisation for database logs
- Visual indicators for correlation groups

## Quick start

Prerequisites: Node.js (16+ recommended) and npm.

1. Install dependencies (if not done):

```bash
npm install
```

2. Start dev server:

```bash
npm start
# open http://localhost:4200/
```

3. Drag an example file from `examples/sample.log` into the upload area or click `Selecionar ficheiro`.

## Usage

- Use the search box for quick lookups by message, date, status code, HTTP method, or correlation id.
- Use the regex filter for advanced pattern matching.
- Use the time range filters to narrow by start and/or end time (HH:mm:ss format).
- Toggle levels and types to further narrow results.

## Developer notes

- The frontend is an Angular standalone-components app (Angular 20).
- **Performance optimizations:**
  - **WebWorker**: Log parsing runs in a background thread to prevent UI blocking for large files
  - **Chunking**: Large files are processed in 5000-line chunks with progress reporting
  - **Style caching**: Type, level, and HTTP method styles use Map caches for O(1) lookup instead of object lookups
  - **Date caching**: Formatted dates are cached (max 10,000 entries) to avoid repeated expensive toLocaleString() calls
  - **Progressive rendering**: Logs and filters are updated as parsing progresses (visible in the progress bar)
- For parsing fallback to main thread or very large files, consider increasing chunk size in `log-parser.service.ts`
- Example log file: `examples/sample.log` (NDJSON).
## Project structure (important files)

- `src/app/components/file-upload` - upload UI and drag/drop
- `src/app/components/logs-list` - log listing, filters and saved filters
- `src/app/components/bar-chart` - chart component (Chart.js)
- `src/app/services/log-parser.service.ts` - main parsing logic
- `examples/sample.log` - sample NDJSON file
