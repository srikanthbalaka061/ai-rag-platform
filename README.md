# AI RAG Platform

TypeScript/Express RAG service with local Hugging Face embeddings and Qdrant
vector storage.

Chunking uses LangChain's `RecursiveCharacterTextSplitter`; local embedding
uses the LangChain `Embeddings` interface backed by the configured
Transformers.js model. Query and document embeddings share the same model and
pooling/normalization settings.

## Supported ingestion formats

The upload pipeline currently supports PDF, DOCX, TXT, Markdown (`.md` and
`.markdown`), CSV, Excel (`.xls` and `.xlsx`), JSON, and HTML (`.html` and
`.htm`). It extracts text, normalizes it, creates overlapping chunks, embeds
them, and stores the chunks with tenant and source metadata in Qdrant.

This is a finite list of implemented formats, not support for arbitrary file
types. Legacy `.doc`, PowerPoint, image files, scanned-PDF OCR, and other
formats require additional loaders.

## Configuration

Copy `.env.example` to `.env` and set Qdrant credentials:

```text
PORT=3000
QDRANT_URL=https://your-qdrant-instance
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_COLLECTION=enterprise_documents
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
GENERATION_MODEL=Xenova/flan-t5-small
BHARATSTOCK_BASE_URL=https://bharatstockapi.com
BHARATSTOCK_API_KEY=your-bharatstock-api-key
BHARATSTOCK_TIMEOUT_MS=10000
MARKET_DATA_SYNC_TIMEZONE=Asia/Kolkata
MARKET_DATA_SYNC_MAX_PAGES=100
MARKET_DATA_API_TOKEN=use-a-random-secret-at-least-32-characters-long
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

The configured embedding model must return vectors matching
`EMBEDDING_DIMENSION`. The server initializes the Qdrant collection on startup.
The market-data integration requires a BharatStock API key, a private bearer
token for callers, and Supabase project credentials. Keep the Supabase
service-role key server-side; never expose it to clients.

## API

Upload one document as `multipart/form-data` to `POST /api/documents/ingest`.
Include `file`, `tenantId`, and `uploadedBy`; `tags` is optional and accepts
comma-separated values. Uploads are limited to 25 MiB and temporary files are
removed after processing.

```sh
curl -X POST http://localhost:3000/api/documents/ingest \
  -F "file=@./document.pdf" \
  -F "tenantId=tenant-1" \
  -F "uploadedBy=user-1"
```

Ask questions through `POST /api/rag/ask` with a JSON body containing
`question` (optional: `topK` and `scoreThreshold`). The ask endpoint searches
all indexed documents and does not require a `tenantId`.

Delete all indexed chunks for a document with
`DELETE /api/documents/:documentId?tenantId=...`. The Qdrant filter matches both
`documentId` and `tenantId`, so the operation cannot delete another tenant's
document chunks. Qdrant is asked to wait for the delete operation before
returning.

## BharatStock market data

The market-data routes run in the same Express server as the AI/RAG routes.
Start the application once with `npm run dev`; market data is available under
`/api/market-data` on the configured `PORT`.

AI/RAG and market-data each keep their routes and service code in their own
domain folders. Market-data API clients, repositories, validation, and
database migrations live under `src/market-data/`.

The scheduler runs Monday through Friday at 11:00 PM in
`MARKET_DATA_SYNC_TIMEZONE` (default `Asia/Kolkata`); Saturday and Sunday runs
are skipped. Each feed is fetched market-wide with `page_size=200`. The sync
keeps paging while records match the current date in that timezone, and stops
when it reaches a record from another date. It stores each deal or insider
disclosure as its own row in Supabase, along with a per-feed sync marker for the
date (including days with no records). A database lease prevents duplicate
scheduled runs across multiple server instances. Failed feeds are reported in
server logs; the latest successful sync remains available to the UI.

```sh
curl -H "Authorization: Bearer $MARKET_DATA_API_TOKEN" \
  "http://localhost:3000/api/market-data/deals/bulk?page=1&page_size=20"
```

These market-wide UI endpoints read saved records and do not call BharatStock
on user requests. Responses include `snapshot_date` in the JSON body;
`X-Market-Data-Snapshot-Date` and `X-Market-Data-Fetched-At` identify the
returned sync. Supported calls include:

- `GET /api/market-data/deals/bulk` and `/deals/block`
- `GET /api/market-data/insider-trades`

The same endpoints support `symbol`, `buyer`, `seller`, `client_name`,
`buy_sell`, and date filters. Use `range=week` or `range=month` for the last
7 or 30 calendar days, or `range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD` for a
specific range. Without a range, the endpoint returns the latest synced date.
Name filters are case-insensitive partial matches. For bulk and block deals,
`buyer`/`seller` select `client_name` records on the matching `buy_sell` side;
for insider trades, they map to acquisition/disposal disclosures.
For example:

```text
/api/market-data/deals/bulk?symbol=RELIANCE&buyer=Fund&buy_sell=BUY&range=week
/api/market-data/deals/block?client_name=Mutual%20Fund&from=2026-11-01&to=2026-11-25
/api/market-data/insider-trades?symbol=INFY&transaction_type=acquisition&range=month
```

Screener calls still fetch BharatStock on demand and save their responses in
`public.market_data_responses`:

- `GET /api/market-data/screener?filter=pe_ratio.lt.15&page=1&page_size=20`

The API key is sent only to BharatStock, and callers must authenticate using
the configured bearer token. Unsupported paths and non-GET methods are
rejected. Before the first scheduled run, the market-wide endpoints
return `503` because no daily data is available yet.

Apply all SQL migrations in `src/market-data/supabase/migrations/` to the Supabase project
before starting the service. Row-level security is enabled without client
policies; server-side reads and writes use the service-role key.

**Deployment requirement:** the existing AI ingestion and RAG endpoints still
need application authentication; derive `tenantId` and `uploadedBy` from the
authenticated identity before exposing them.

## Development

- `npm run dev` starts the development server.
- `npm run build` type-checks and compiles the project.
- `npm test` runs ingestion pipeline and chunking tests.
- `npm run test:qdrant` runs the Qdrant integration test and requires valid
  Qdrant configuration.
