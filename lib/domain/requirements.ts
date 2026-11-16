import { prisma } from "@/lib/prisma";

export type MaterialRequirement = {
  rawMaterialId: string;
  rawMaterialName: string;
  unit: string;
  requiredQuantity: number;
  availableQuantity: number; // on-hand minus already-reserved, summed across warehouses
  shortfall: number; // max(0, required - available)
};

/**
 * BOM explosion — §6 step 3 / §7 "Production Management": for a product and
 * order quantity, sum each BOM line's quantityPerUnit × orderQty, and compare
 * against currently available (unreserved) inventory of that material.
 */
export async function explodeMaterialRequirements(productId: string, orderQuantity: number): Promise<MaterialRequirement[]> {
  const bom = await prisma.productMaterial.findMany({
    where: { productId },
    include: { rawMaterial: { include: { inventory: true } } },
  });

  return bom.map((line) => {
    const required = line.quantityPerUnit * orderQuantity;
    const available = line.rawMaterial.inventory.reduce(
      (sum, inv) => sum + (inv.quantityOnHand - inv.quantityReserved),
      0,
    );
    return {
      rawMaterialId: line.rawMaterialId,
      rawMaterialName: line.rawMaterial.name,
      unit: line.rawMaterial.unit,
      requiredQuantity: required,
      availableQuantity: available,
      shortfall: Math.max(0, required - available),
    };
  });
}

/**
 * Reserves material for a production order: increases Inventory.quantityReserved
 * (FIFO across warehouses) and writes a RESERVATION ledger entry per warehouse touched.
 * Returns false if there isn't enough unreserved stock anywhere.
 */
export async function reserveMaterialsForOrder(productionOrderId: string, productId: string, orderQuantity: number) {
  const requirements = await explodeMaterialRequirements(productId, orderQuantity);
  const shortages = requirements.filter((r) => r.shortfall > 0);

  await prisma.$transaction(async (tx) => {
    for (const req of requirements) {
      let remaining = req.requiredQuantity;
      const lots = await tx.inventory.findMany({
        where: { rawMaterialId: req.rawMaterialId },
        orderBy: { quantityOnHand: "desc" },
      });
      for (const lot of lots) {
        if (remaining <= 0) break;
        const free = lot.quantityOnHand - lot.quantityReserved;
        const take = Math.min(free, remaining);
        if (take <= 0) continue;
        await tx.inventory.update({
          where: { id: lot.id },
          data: { quantityReserved: { increment: take } },
        });
        await tx.inventoryTransaction.create({
          data: {
            rawMaterialId: req.rawMaterialId,
            warehouseId: lot.warehouseId,
            type: "RESERVATION",
            quantity: take,
            reference: productionOrderId,
            note: `Reserved for production order`,
          },
        });
        remaining -= take;
      }
    }
  });

  return { ok: shortages.length === 0, shortages, requirements };
}

/**
 * Production order completes: reserved material is actually consumed
 * (on-hand and reserved both drop by the required quantity, ISSUE ledgered),
 * and the finished product's stock increases by the order quantity.
 */
export async function completeProductionOrder(productionOrderId: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: productionOrderId },
    include: { product: true },
  });
  const requirements = await explodeRequiredOnly(order.productId, order.quantity);

  await prisma.$transaction(async (tx) => {
    for (const req of requirements) {
      let remaining = req.requiredQuantity;
      const lots = await tx.inventory.findMany({ where: { rawMaterialId: req.rawMaterialId, quantityReserved: { gt: 0 } } });
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.quantityReserved, remaining);
        if (take <= 0) continue;
        await tx.inventory.update({
          where: { id: lot.id },
          data: { quantityOnHand: { decrement: take }, quantityReserved: { decrement: take } },
        });
        await tx.inventoryTransaction.create({
          data: { rawMaterialId: req.rawMaterialId, warehouseId: lot.warehouseId, type: "ISSUE", quantity: take, reference: order.orderNumber, note: "Issued to completed production order" },
        });
        remaining -= take;
      }
    }

    const fgInventory = await tx.inventory.findFirst({ where: { productId: order.productId } });
    if (fgInventory) {
      await tx.inventory.update({ where: { id: fgInventory.id }, data: { quantityOnHand: { increment: order.quantity } } });
    } else {
      const anyWarehouse = await tx.warehouse.findFirstOrThrow();
      await tx.inventory.create({ data: { warehouseId: anyWarehouse.id, productId: order.productId, quantityOnHand: order.quantity, quantityReserved: 0 } });
    }

    await tx.productionOrder.update({ where: { id: productionOrderId }, data: { status: "COMPLETED" } });
  });

  return order;
}

/** Cancels an order and releases any material it had reserved, without consuming it. */
export async function releaseReservationsForOrder(productionOrderId: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id: productionOrderId } });
  const requirements = await explodeRequiredOnly(order.productId, order.quantity);

  await prisma.$transaction(async (tx) => {
    for (const req of requirements) {
      let remaining = req.requiredQuantity;
      const lots = await tx.inventory.findMany({ where: { rawMaterialId: req.rawMaterialId, quantityReserved: { gt: 0 } } });
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.quantityReserved, remaining);
        if (take <= 0) continue;
        await tx.inventory.update({ where: { id: lot.id }, data: { quantityReserved: { decrement: take } } });
        await tx.inventoryTransaction.create({
          data: { rawMaterialId: req.rawMaterialId, warehouseId: lot.warehouseId, type: "RELEASE", quantity: take, reference: order.orderNumber, note: "Reservation released (order cancelled)" },
        });
        remaining -= take;
      }
    }
    await tx.productionOrder.update({ where: { id: productionOrderId }, data: { status: "CANCELLED" } });
  });

  return order;
}

async function explodeRequiredOnly(productId: string, orderQuantity: number) {
  const bom = await prisma.productMaterial.findMany({ where: { productId } });
  return bom.map((line) => ({ rawMaterialId: line.rawMaterialId, requiredQuantity: line.quantityPerUnit * orderQuantity }));
}
