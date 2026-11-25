import { qdrantClient } from "../../../config/qdrant.js";
import { env } from "../../../config/env.js";
import type {
  VectorRecord,
  VectorStore,
} from "../../core/ingestion.types.js";

const UPSERT_BATCH_SIZE = 64;

export class QdrantVectorStore implements VectorStore {
  async documentExists(documentId: string, tenantId: string): Promise<boolean> {
    const result = await qdrantClient.scroll(env.qdrantCollection, {
      limit: 1,
      with_payload: false,
      with_vector: false,
      filter: {
        must: [
          { key: "documentId", match: { value: documentId } },
          { key: "tenantId", match: { value: tenantId } },
        ],
      },
    });
    return result.points.length > 0;
  }

  async deleteDocumentChunks(
    documentId: string,
    tenantId: string
  ): Promise<{ operationId: number | null; status: string }> {
    if (!documentId.trim() || !tenantId.trim()) {
      throw new Error("Document ID and tenant ID are required");
    }

    const result = await qdrantClient.delete(env.qdrantCollection, {
      wait: true,
      filter: {
        must: [
          { key: "documentId", match: { value: documentId } },
          { key: "tenantId", match: { value: tenantId } },
        ],
      },
    });

    return {
      operationId: result.operation_id ?? null,
      status: result.status,
    };
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    for (let offset = 0; offset < records.length; offset += UPSERT_BATCH_SIZE) {
      const batch = records.slice(offset, offset + UPSERT_BATCH_SIZE);

      for (const record of batch) {
        if (
          record.vector.length !== env.embeddingDimension ||
          !record.vector.every(Number.isFinite)
        ) {
          throw new Error(
            `Invalid vector for record ${record.id}: expected ${env.embeddingDimension} finite values`
          );
        }
      }

      await qdrantClient.upsert(env.qdrantCollection, {
        wait: true,
        points: batch.map((record) => ({
          id: record.id,
          vector: record.vector,
          payload: record.payload,
        })),
      });
    }
  }
}
