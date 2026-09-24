import { pool } from "../adapters/postgres/PostgresAdapter";
import { createLogger } from "../observability/logger";
import { resolveProjectTimezone } from "../config/intelligence";

const logger = createLogger("DailyIntelligenceService");

export interface DailyProjectIntelligenceRecord {
  id: number;
  projectId: number;
  date: string;
  timezone: string;
  totalConversations: number;
  totalMessages: number;
  totalTickets: number;
  resolvedTickets: number;
  slaBreaches: number;
  humanHandoffs: number;
  botDeflectionRate: number;
  avgLatencyMs: number;
  totalTokensConsumed: number;
  topIssueCategories: Array<{ category: string; count: number }>;
  topKnowledgeGaps: any[];
  narrativeSummary: string;
  modelVersion: string;
  algorithmVersion: string;
  createdAt: string;
  updatedAt: string;
}

export class DailyIntelligenceService {
  private pool: any;

  constructor(customPool?: any) {
    this.pool = customPool || pool;
  }

  /**
   * Deterministically calculates, persists (via safe UPSERT), and returns daily intelligence rollups
   * for a project on a specific calendar date in the project's configured timezone.
   */
  async calculateDailyRollup(projectId: number, dateStr: string): Promise<DailyProjectIntelligenceRecord> {
    const client = await this.pool.connect();
    try {
      // 1. Fetch project timezone
      const projRes = await client.query(
        "SELECT id, timezone FROM projects WHERE id = $1 AND deleted_at IS NULL LIMIT 1;",
        [projectId]
      );
      if (projRes.rows.length === 0) {
        throw new Error(`Project ${projectId} not found`);
      }
      const tz = resolveProjectTimezone(projRes.rows[0].timezone);

      // 2. Resolve calendar date boundaries in project timezone
      const boundsRes = await client.query(
        `SELECT 
           ($1 || ' 00:00:00')::timestamp AT TIME ZONE $2 AS day_start,
           ($1 || ' 23:59:59.999')::timestamp AT TIME ZONE $2 AS day_end;`,
        [dateStr, tz]
      );
      const dayStart: Date = boundsRes.rows[0].day_start;
      const dayEnd: Date = boundsRes.rows[0].day_end;

      // 3. Deterministic SQL aggregates within day boundaries
      // 3a. Total conversations
      const convRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM conversations 
         WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND deleted_at IS NULL;`,
        [projectId, dayStart, dayEnd]
      );
      const totalConversations = Number(convRes.rows[0]?.total || 0);

      // 3b. Total messages
      const msgRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.project_id = $1 AND m.created_at >= $2 AND m.created_at <= $3;`,
        [projectId, dayStart, dayEnd]
      );
      const totalMessages = Number(msgRes.rows[0]?.total || 0);

      // 3c. Tickets created in day
      const ticketRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM tickets 
         WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND deleted_at IS NULL;`,
        [projectId, dayStart, dayEnd]
      );
      const totalTickets = Number(ticketRes.rows[0]?.total || 0);

      // 3d. Tickets resolved in day
      const resolvedRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM tickets 
         WHERE project_id = $1 AND resolved_at >= $2 AND resolved_at <= $3 AND deleted_at IS NULL;`,
        [projectId, dayStart, dayEnd]
      );
      const resolvedTickets = Number(resolvedRes.rows[0]?.total || 0);

      // 3e. SLA breaches in day
      const slaRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM tickets 
         WHERE project_id = $1 AND sla_breached = true AND sla_breach_at >= $2 AND sla_breach_at <= $3 AND deleted_at IS NULL;`,
        [projectId, dayStart, dayEnd]
      );
      const slaBreaches = Number(slaRes.rows[0]?.total || 0);

      // 3f. Human handoffs initiated in day
      const handoffRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM conversation_handoffs 
         WHERE project_id = $1 AND started_at >= $2 AND started_at <= $3;`,
        [projectId, dayStart, dayEnd]
      );
      const humanHandoffs = Number(handoffRes.rows[0]?.total || 0);

      // 3g. Bot deflection rate:
      // Approved contract:
      // - Event/day boundary based on the approved daily metric contract (closed_at / status)
      // - Numerator: closed/resolved conversations with handled_by = 'ai' and no handoff
      // - Denominator: total eligible conversations handled by bot
      // - Zero denominator => 0.0
      // Note: The physical conversations table schema does not include closed_at; the resolution/closure
      // transition event timestamp is captured by updated_at when status IN ('resolved', 'closed').
      const botNumRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM conversations c
         WHERE c.project_id = $1 
           AND c.handled_by = 'ai' 
           AND c.status IN ('resolved', 'closed') 
           AND c.updated_at >= $2 
           AND c.updated_at <= $3 
           AND c.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM conversation_handoffs ch WHERE ch.conversation_id = c.id
           );`,
        [projectId, dayStart, dayEnd]
      );
      const botResolvedCount = Number(botNumRes.rows[0]?.total || 0);

      const botDenomRes = await client.query(
        `SELECT count(*)::integer AS total 
         FROM conversations c
         WHERE c.project_id = $1 
           AND c.deleted_at IS NULL
           AND (
             c.handled_by = 'ai' 
             OR EXISTS (
               SELECT 1 FROM conversation_handoffs ch 
               WHERE ch.conversation_id = c.id 
                 AND (ch.from_handler = 'ai' OR ch.from_handler IS NULL)
             )
           )
           AND (
             (c.created_at >= $2 AND c.created_at <= $3)
             OR (c.status IN ('resolved', 'closed') AND c.updated_at >= $2 AND c.updated_at <= $3)
           );`,
        [projectId, dayStart, dayEnd]
      );
      const eligibleBotCount = Number(botDenomRes.rows[0]?.total || 0);

      const botDeflectionRate = eligibleBotCount > 0
        ? Math.min(1.0, Number((botResolvedCount / eligibleBotCount).toFixed(4)))
        : 0.0;

      // 3h. Average latency from traces
      const latRes = await client.query(
        `SELECT COALESCE(AVG(ROUND(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, t.called_at) - t.called_at)) * 1000)), 0)::numeric(10,2) AS avg_lat
         FROM traces t
         WHERE t.conversation_id IN (
           SELECT id::text FROM conversations WHERE project_id = $1
         )
         AND t.called_at >= $2 AND t.called_at <= $3;`,
        [projectId, dayStart, dayEnd]
      );
      const avgLatencyMs = Number(latRes.rows[0]?.avg_lat || 0.0);
      const totalTokensConsumed = 0; // Authoritative live schema does not track token columns on traces

      // 3i. Top issue categories
      const catRes = await client.query(
        `SELECT COALESCE(NULLIF(issue_category, ''), 'General') AS category, count(*)::integer AS count
         FROM tickets
         WHERE project_id = $1 AND created_at >= $2 AND created_at <= $3 AND deleted_at IS NULL
         GROUP BY category
         ORDER BY count DESC
         LIMIT 5;`,
        [projectId, dayStart, dayEnd]
      );
      const topIssueCategories = catRes.rows.map((r: any) => ({
        category: String(r.category),
        count: Number(r.count),
      }));

      // 3j. Deterministic narrative interpretation derived purely from calculated SQL facts
      const narrativeSummary = `Operational report for ${dateStr} (timezone: ${tz}): ` +
        `The project handled ${totalConversations} conversations and received ${totalTickets} tickets ` +
        `(${resolvedTickets} resolved). Human handoffs: ${humanHandoffs}, SLA breaches: ${slaBreaches}. ` +
        `Bot deflection rate achieved: ${(botDeflectionRate * 100).toFixed(1)}% ` +
        `with an average tool execution latency of ${avgLatencyMs}ms.`;

      // 4. Safe UPSERT on (project_id, date)
      const upsertSql = `
        INSERT INTO daily_project_intelligence (
          project_id, date, timezone, total_conversations, total_messages, total_tickets,
          resolved_tickets, sla_breaches, human_handoffs, bot_deflection_rate, avg_latency_ms,
          total_tokens_consumed, top_issue_categories, top_knowledge_gaps, narrative_summary,
          model_version, algorithm_version, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'v1', 'v1', NOW()
        )
        ON CONFLICT (project_id, date) DO UPDATE SET
          timezone = EXCLUDED.timezone,
          total_conversations = EXCLUDED.total_conversations,
          total_messages = EXCLUDED.total_messages,
          total_tickets = EXCLUDED.total_tickets,
          resolved_tickets = EXCLUDED.resolved_tickets,
          sla_breaches = EXCLUDED.sla_breaches,
          human_handoffs = EXCLUDED.human_handoffs,
          bot_deflection_rate = EXCLUDED.bot_deflection_rate,
          avg_latency_ms = EXCLUDED.avg_latency_ms,
          total_tokens_consumed = EXCLUDED.total_tokens_consumed,
          top_issue_categories = EXCLUDED.top_issue_categories,
          narrative_summary = EXCLUDED.narrative_summary,
          updated_at = NOW()
        RETURNING *;
      `;

      const upsertRes = await client.query(upsertSql, [
        projectId,
        dateStr,
        tz,
        totalConversations,
        totalMessages,
        totalTickets,
        resolvedTickets,
        slaBreaches,
        humanHandoffs,
        botDeflectionRate,
        avgLatencyMs,
        totalTokensConsumed,
        JSON.stringify(topIssueCategories),
        JSON.stringify([]),
        narrativeSummary,
      ]);

      const r = upsertRes.rows[0];
      return this.mapRecord(r);
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves an existing daily rollup, or calculates it on-demand if absent.
   */
  async getDailyIntelligence(projectId: number, dateStr: string): Promise<DailyProjectIntelligenceRecord> {
    const res = await this.pool.query(
      `SELECT * FROM daily_project_intelligence 
       WHERE project_id = $1 AND date = $2::date LIMIT 1;`,
      [projectId, dateStr]
    );
    if (res.rows.length > 0) {
      return this.mapRecord(res.rows[0]);
    }
    return this.calculateDailyRollup(projectId, dateStr);
  }

  /**
   * Queries daily rollups for a range of dates across authorized projects.
   */
  async getDailyRollupsRange(
    authorizedProjectIds: number[] | null,
    fromDate: string,
    toDate: string
  ): Promise<DailyProjectIntelligenceRecord[]> {
    const conditions: string[] = ["date >= $1::date AND date <= $2::date"];
    const values: any[] = [fromDate, toDate];
    let idx = 3;

    if (authorizedProjectIds !== null) {
      conditions.push(`project_id = ANY($${idx}::integer[])`);
      values.push(authorizedProjectIds);
      idx++;
    }

    const sql = `
      SELECT * FROM daily_project_intelligence
      WHERE ${conditions.join(" AND ")}
      ORDER BY date DESC, project_id ASC;
    `;

    const res = await this.pool.query(sql, values);
    return res.rows.map((r: any) => this.mapRecord(r));
  }

  private mapRecord(r: any): DailyProjectIntelligenceRecord {
    let formattedDate = "";
    if (r.date instanceof Date) {
      const y = r.date.getFullYear();
      const m = String(r.date.getMonth() + 1).padStart(2, "0");
      const d = String(r.date.getDate()).padStart(2, "0");
      formattedDate = `${y}-${m}-${d}`;
    } else {
      formattedDate = String(r.date || "").slice(0, 10);
    }

    return {
      id: Number(r.id),
      projectId: Number(r.project_id),
      date: formattedDate,
      timezone: r.timezone,
      totalConversations: Number(r.total_conversations || 0),
      totalMessages: Number(r.total_messages || 0),
      totalTickets: Number(r.total_tickets || 0),
      resolvedTickets: Number(r.resolved_tickets || 0),
      slaBreaches: Number(r.sla_breaches || 0),
      humanHandoffs: Number(r.human_handoffs || 0),
      botDeflectionRate: Number(r.bot_deflection_rate || 0.0),
      avgLatencyMs: Number(r.avg_latency_ms || 0.0),
      totalTokensConsumed: Number(r.total_tokens_consumed || 0),
      topIssueCategories: typeof r.top_issue_categories === "string" ? JSON.parse(r.top_issue_categories) : r.top_issue_categories,
      topKnowledgeGaps: typeof r.top_knowledge_gaps === "string" ? JSON.parse(r.top_knowledge_gaps) : r.top_knowledge_gaps,
      narrativeSummary: r.narrative_summary || "",
      modelVersion: r.model_version || "v1",
      algorithmVersion: r.algorithm_version || "v1",
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }
}
