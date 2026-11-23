# AI RAG Platform

TypeScript/Express RAG service with local Hugging Face embeddings and Qdrant
vector storage.

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
```

The configured embedding model must return vectors matching
`EMBEDDING_DIMENSION`. The server initializes the Qdrant collection on startup.

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
`question` and `tenantId` (optional: `topK` and `scoreThreshold`).

**Deployment requirement:** add authentication and derive `tenantId` and
`uploadedBy` from the authenticated identity before exposing these endpoints.
The current API validates those fields but does not authenticate callers.

## Development

- `npm run dev` starts the development server.
- `npm run build` type-checks and compiles the project.
- `npm test` runs ingestion pipeline and chunking tests.
- `npm run test:qdrant` runs the Qdrant integration test and requires valid
  Qdrant configuration.
