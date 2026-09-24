import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { createLogger } from "../../observability/logger";
import { createRedisClient } from "../../infrastructure/cache/createRedisClient";
import { INTELLIGENCE_CONFIG } from "../../config/intelligence";
import { KnowledgeGapService } from "../../services/KnowledgeGapService";

const logger = createLogger("KnowledgeGapWorker");

export class KnowledgeGapWorker {
  private worker: Worker;
  private redisConnection: Redis;
  private knowledgeGapService: KnowledgeGapService;

  constructor(customService?: KnowledgeGapService) {
    this.knowledgeGapService = customService || new KnowledgeGapService();
    this.redisConnection = createRedisClient("knowledge-gap-worker", {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });

    this.worker = new Worker(
      INTELLIGENCE_CONFIG.queue.name,
      async (job: Job) => {
        const { name, data } = job;
        const jobId = job.id || "unknown";

        if (name === "intelligence.knowledge_gap.evaluate") {
          const { projectId, conversationId, messageId } = data;
          const lockKey = `processed:kg:eval:${projectId}:${conversationId}:${messageId}`;

          // Dual-layer Idempotency Guard (Layer 1: Redis NX)
          const setRes = await this.redisConnection.set(lockKey, "processing", "EX", 86400, "NX");
          if (setRes !== "OK") {
            logger.info({ jobId, lockKey }, "Knowledge gap evaluation bypassed by Redis Idempotency Guard");
            return { skipped: true, reason: "already_processed" };
          }

          try {
            const result = await this.knowledgeGapService.evaluateAndPersistCandidate({
              projectId: Number(projectId),
              conversationId: Number(conversationId),
              messageId: Number(messageId),
              queryText: data.queryText,
              aiResponseText: data.aiResponseText,
              retrievalConfidence: data.retrievalConfidence,
              retrievedDocsCount: data.retrievedDocsCount,
              messageCreatedAt: data.messageCreatedAt,
            });

            logger.info(
              { jobId, projectId, conversationId, isCandidate: result.isCandidate, score: result.score },
              "Knowledge gap candidate evaluation complete"
            );
            return result;
          } catch (err: any) {
            // Clear lock on failure to allow retry
            await this.redisConnection.del(lockKey).catch(() => {});
            logger.error({ error: err.message, jobId }, "Failed to evaluate knowledge gap candidate in worker");
            throw err;
          }
        } else if (name === "intelligence.knowledge_gap.cluster") {
          const { projectId } = data;
          const lockKey = `processed:kg:cluster:${projectId}`;

          const setRes = await this.redisConnection.set(lockKey, "processing", "EX", 300, "NX");
          if (setRes !== "OK") {
            logger.info({ jobId, projectId }, "Clustering run already in progress; skipped");
            return { skipped: true, reason: "clustering_in_progress" };
          }

          try {
            const result = await this.knowledgeGapService.runClusteringForProject(Number(projectId));
            logger.info({ jobId, projectId, clustersCreated: result.clustersCreated }, "Clustering run completed");
            return result;
          } catch (err: any) {
            logger.error({ error: err.message, jobId, projectId }, "Failed to run clustering in worker");
            throw err;
          } finally {
            await this.redisConnection.del(lockKey).catch(() => {});
          }
        } else {
          logger.debug({ jobName: name }, "Ignored unrecognized job in conversation-intelligence-queue");
          return { ignored: true };
        }
      },
      {
        connection: this.redisConnection as any,
        concurrency: INTELLIGENCE_CONFIG.queue.concurrency,
      }
    );

    this.worker.on("error", (err) => {
      logger.error({ error: err.message }, "KnowledgeGapWorker encountered an error");
    });
  }

  async close(): Promise<void> {
    logger.info("Closing KnowledgeGapWorker...");
    await this.worker.close();
    await this.redisConnection.quit();
    logger.info("KnowledgeGapWorker closed.");
  }
}
