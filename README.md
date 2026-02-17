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
- Toggle levels and types to further narrow results.

## Developer notes

- The frontend is an Angular standalone-components app (Angular 20).
- Parsing is done on the main thread in `LogParserService`. For very large files consider moving parsing/filtering to a WebWorker.
- Example log file: `examples/sample.log` (NDJSON).
## Project structure (important files)

- `src/app/components/file-upload` - upload UI and drag/drop
- `src/app/components/logs-list` - log listing, filters and saved filters
- `src/app/components/bar-chart` - chart component (Chart.js)
- `src/app/services/log-parser.service.ts` - main parsing logic
- `examples/sample.log` - sample NDJSON file
