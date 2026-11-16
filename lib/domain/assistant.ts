/**
 * AI Operations Assistant — §13 "AI Agent and Automation Workflow".
 *
 * The blueprint is explicit that the assistant should "operate through
 * controlled tools rather than unrestricted database access" and that
 * "high-impact actions such as purchase commitments should remain behind
 * explicit human approval". This is a deterministic (non-LLM) tool-calling
 * agent: it parses the user's message with simple intent/entity matching,
 * then calls the exact same tool functions §13's example transcript lists
 * (get_inventory, get_forecast, get_open_purchase_orders,
 * get_supplier_options, calculate_requirement, create_purchase_request,
 * record_approval_requirement, write_audit_log) against the real domain
 * engine — nothing here is a canned string keyed to a demo script. Swapping
 * in a real LLM later means replacing the intent parser with a tool-calling
 * loop against the same `tools` object; the tools themselves don't change.
 */
import { prisma } from "@/lib/prisma";
import { computeRiskForMaterial, generateRecommendationForMaterial } from "@/lib/domain/workflow";
import { rankSuppliers } from "@/lib/domain/suppliers";
import { recordAudit } from "@/lib/auth";

export type ToolCall = { tool: string; args: Record<string, unknown>; result: unknown };
export type AssistantContext = { lastMaterialId?: string | null; lastMaterialName?: string | null };
export type AssistantResponse = { reply: string; toolTrace: ToolCall[]; context: AssistantContext };

// ---------------------------------------------------------------- tools

const tools = {
  async get_inventory(rawMaterialId: string) {
    const material = await prisma.rawMaterial.findUniqueOrThrow({ where: { id: rawMaterialId }, include: { inventory: true } });
    const onHand = material.inventory.reduce((s, i) => s + i.quantityOnHand, 0);
    const reserved = material.inventory.reduce((s, i) => s + i.quantityReserved, 0);
    return { name: material.name, unit: material.unit, onHand, reserved, available: onHand - reserved, safetyStock: material.safetyStock };
  },
  async get_forecast(rawMaterialId: string) {
    const { assessment } = await computeRiskForMaterial(rawMaterialId);
    return {
      averageDailyDemand: round2(assessment.averageDailyDemand),
      leadTimeDemand: round2(assessment.leadTimeDemand),
      reorderPoint: round2(assessment.reorderPoint),
    };
  },
  async get_open_purchase_orders(rawMaterialId: string) {
    const lines = await prisma.purchaseOrderLine.findMany({
      where: { rawMaterialId, purchaseOrder: { status: "ORDERED" } },
      include: { purchaseOrder: { include: { supplier: true } } },
    });
    return lines.map((l) => ({
      poNumber: l.purchaseOrder.poNumber,
      quantity: l.quantity,
      supplier: l.purchaseOrder.supplier.name,
      expectedDate: l.purchaseOrder.expectedDate.toISOString().slice(0, 10),
    }));
  },
  async get_supplier_options(rawMaterialId: string) {
    const offers = await prisma.supplierMaterial.findMany({ where: { rawMaterialId }, include: { supplier: true } });
    return rankSuppliers(
      offers.map((o) => ({
        supplierId: o.supplierId,
        supplierName: o.supplier.name,
        unitPrice: o.unitPrice,
        leadTimeDays: o.leadTimeDays,
        reliability: o.supplier.reliability,
        qualityScore: o.supplier.qualityScore,
        minOrderQty: o.minOrderQty,
      })),
    );
  },
  async calculate_requirement(rawMaterialId: string) {
    const { assessment, rawMaterial } = await computeRiskForMaterial(rawMaterialId);
    return {
      material: rawMaterial.name,
      riskLevel: assessment.riskLevel,
      stockoutDate: assessment.stockoutDate?.toISOString().slice(0, 10) ?? null,
      daysUntilStockout: assessment.daysUntilStockout,
    };
  },
  async create_purchase_request(rawMaterialId: string, actorId?: string | null) {
    return generateRecommendationForMaterial(rawMaterialId, actorId);
  },
  async record_approval_requirement(recommendationId: string) {
    return { recommendationId, requiresApprovalFrom: ["MANAGEMENT", "PROCUREMENT_MANAGER", "FACTORY_ADMIN"] };
  },
};

// ---------------------------------------------------------------- intent parsing

async function findMentionedMaterial(message: string): Promise<{ id: string; name: string } | null> {
  const materials = await prisma.rawMaterial.findMany({ select: { id: true, name: true } });
  const lower = message.toLowerCase();
  let best: { id: string; name: string } | null = null;
  for (const m of materials) {
    if (lower.includes(m.name.toLowerCase())) {
      if (!best || m.name.length > best.name.length) best = m;
    }
  }
  return best;
}

const CREATE_PATTERNS = /\b(create|raise|submit|generate|place)\b.*\b(purchase request|purchase order|po|request)\b/i;
const APPROVE_PATTERNS = /\b(approve|accept)\b/i;
const MACHINE_PATTERNS = /\b(machine|anomaly|maintenance|equipment|sensor)\b/i;
const RISK_SUMMARY_PATTERNS = /\b(summary|overview|dashboard|risks?|status)\b/i;

export async function runAssistant(message: string, context: AssistantContext = {}, actorId?: string | null): Promise<AssistantResponse> {
  const trace: ToolCall[] = [];
  const record = (tool: string, args: Record<string, unknown>, result: unknown) => trace.push({ tool, args, result });

  if (MACHINE_PATTERNS.test(message)) {
    const machines = await prisma.machine.findMany({
      include: { readings: { orderBy: { recordedAt: "desc" }, take: 1 } },
    });
    const attention = machines.filter((m) => m.status === "ATTENTION");
    record("get_machine_status", {}, machines.map((m) => ({ code: m.code, status: m.status, lastAnomalyScore: m.readings[0]?.anomalyScore ?? null })));
    const reply =
      attention.length > 0
        ? `${attention.length} machine(s) need attention: ${attention.map((m) => `${m.name} (${m.code})`).join(", ")}. Anomaly scores are elevated above the healthy baseline — recommend scheduling maintenance.`
        : "All machines are within their normal operating baseline. No maintenance action needed right now.";
    return { reply, toolTrace: trace, context };
  }

  if (RISK_SUMMARY_PATTERNS.test(message) && !CREATE_PATTERNS.test(message)) {
    const materials = await prisma.rawMaterial.findMany({ select: { id: true, name: true } });
    const risks = [];
    for (const m of materials) {
      const { assessment } = await computeRiskForMaterial(m.id);
      risks.push({ name: m.name, riskLevel: assessment.riskLevel, daysUntilStockout: assessment.daysUntilStockout });
    }
    record("calculate_requirement", { scope: "all_materials" }, risks);
    const high = risks.filter((r) => r.riskLevel === "HIGH");
    const medium = risks.filter((r) => r.riskLevel === "MEDIUM");
    const reply =
      high.length > 0
        ? `${high.length} material(s) at HIGH stockout risk: ${high.map((r) => r.name).join(", ")}. ${medium.length} at MEDIUM. Check the Approvals page for pending recommendations.`
        : medium.length > 0
        ? `No HIGH risk materials right now. ${medium.length} at MEDIUM risk: ${medium.map((r) => r.name).join(", ")}.`
        : "All materials are within safe stock levels for the current planning horizon.";
    return { reply, toolTrace: trace, context };
  }

  if (APPROVE_PATTERNS.test(message)) {
    return {
      reply:
        "I can create and analyze purchase requests, but approving them is a human decision by design (§16 least-privilege for AI tools). Please review and approve or reject on the Approvals page.",
      toolTrace: trace,
      context,
    };
  }

  if (CREATE_PATTERNS.test(message)) {
    const material = (await findMentionedMaterial(message)) ?? (context.lastMaterialId ? { id: context.lastMaterialId, name: context.lastMaterialName ?? "" } : null);
    if (!material) {
      return { reply: "Which material should the purchase request be for? Ask me to check a specific material first.", toolTrace: trace, context };
    }
    const result = await tools.create_purchase_request(material.id, actorId);
    record("create_purchase_request", { rawMaterialId: material.id }, result);
    if (result.recommendation) {
      const approvalReq = await tools.record_approval_requirement(result.recommendation.id);
      record("record_approval_requirement", { recommendationId: result.recommendation.id }, approvalReq);
      await recordAudit({
        actorId,
        action: "ASSISTANT_CREATED_PURCHASE_REQUEST",
        entityType: "Recommendation",
        entityId: result.recommendation.id,
        summary: `AI assistant created a purchase request for ${material.name} on request from a user.`,
      });
      return {
        reply: `Purchase request created for ${material.name}: ${result.recommendation.quantity} ${material.name ? "" : ""}units, estimated cost $${round2(result.recommendation.estimatedCost)}. It's now pending approval — a manager needs to review it on the Approvals page.`,
        toolTrace: trace,
        context: { lastMaterialId: material.id, lastMaterialName: material.name },
      };
    }
    return {
      reply: `${material.name} is currently at LOW risk, so I didn't create a purchase request — there's nothing urgent to act on.`,
      toolTrace: trace,
      context: { lastMaterialId: material.id, lastMaterialName: material.name },
    };
  }

  // Default: treat as a stock/status question about a mentioned material.
  const material = await findMentionedMaterial(message);
  if (!material) {
    return {
      reply:
        "I can check inventory, forecasts, and stockout risk for a material (e.g. \"Check whether we need to buy Circuit Board\"), summarize risk across the factory, report machine health, or create a purchase request. What would you like to know?",
      toolTrace: trace,
      context,
    };
  }

  const inventory = await tools.get_inventory(material.id);
  record("get_inventory", { rawMaterialId: material.id }, inventory);
  const forecast = await tools.get_forecast(material.id);
  record("get_forecast", { rawMaterialId: material.id }, forecast);
  const openPOs = await tools.get_open_purchase_orders(material.id);
  record("get_open_purchase_orders", { rawMaterialId: material.id }, openPOs);
  const supplierOptions = await tools.get_supplier_options(material.id);
  record("get_supplier_options", { rawMaterialId: material.id }, supplierOptions);
  const requirement = await tools.calculate_requirement(material.id);
  record("calculate_requirement", { rawMaterialId: material.id }, requirement);

  let reply: string;
  if (requirement.riskLevel === "LOW") {
    reply = `${material.name}: ${inventory.available} ${inventory.unit} available, no purchase needed. Risk is LOW for the next 30 days at the current demand forecast.`;
  } else {
    const best = supplierOptions[0];
    const when = requirement.daysUntilStockout != null ? `within ${requirement.daysUntilStockout} day(s)` : "within the planning horizon";
    reply = `${material.name}: ${requirement.riskLevel} stockout risk ${when}${requirement.stockoutDate ? ` (around ${requirement.stockoutDate})` : ""}. ${openPOs.length > 0 ? `${openPOs.length} PO(s) already inbound. ` : "No purchase orders currently inbound. "}${
      best ? `Best supplier option: ${best.supplierName} at $${best.unitPrice}/unit, ${best.leadTimeDays}-day lead time. ` : ""
    }Say "create the purchase request" if you'd like me to raise one for approval.`;
  }

  return { reply, toolTrace: trace, context: { lastMaterialId: material.id, lastMaterialName: material.name } };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
