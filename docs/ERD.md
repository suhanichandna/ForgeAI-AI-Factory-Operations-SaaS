# ForgeAI — Entity-Relationship Diagram

Source of truth is [`prisma/schema.prisma`](../prisma/schema.prisma); this is a
rendered view of it, grouped the way blueprint §10 groups entities.

```mermaid
erDiagram
    COMPANY ||--o{ FACTORY : has
    COMPANY ||--o{ USER : employs
    FACTORY ||--o{ WAREHOUSE : has
    FACTORY ||--o{ MACHINE : has

    PRODUCT ||--o{ PRODUCT_MATERIAL : "BOM line"
    RAW_MATERIAL ||--o{ PRODUCT_MATERIAL : "used in"
    WAREHOUSE ||--o{ INVENTORY : stores
    RAW_MATERIAL ||--o{ INVENTORY : "stock of"
    PRODUCT ||--o{ INVENTORY : "stock of"
    RAW_MATERIAL ||--o{ INVENTORY_TRANSACTION : ledgers

    PRODUCT ||--o{ PRODUCTION_ORDER : "ordered as"

    SUPPLIER ||--o{ SUPPLIER_MATERIAL : offers
    RAW_MATERIAL ||--o{ SUPPLIER_MATERIAL : "offered by"
    SUPPLIER ||--o{ PURCHASE_ORDER : fulfills
    PURCHASE_ORDER ||--o{ PURCHASE_ORDER_LINE : contains
    RAW_MATERIAL ||--o{ PURCHASE_ORDER_LINE : "line for"

    CUSTOMER ||--o{ SALES_ORDER : places
    SALES_ORDER ||--o{ SALES_ORDER_LINE : contains
    PRODUCT ||--o{ SALES_ORDER_LINE : "line for"

    MACHINE ||--o{ MACHINE_SENSOR_DATA : emits

    PRODUCT ||--o{ FORECAST : "forecast for"
    RAW_MATERIAL ||--o{ RECOMMENDATION : "recommends buying"
    SUPPLIER ||--o{ RECOMMENDATION : "recommended from"
    RECOMMENDATION ||--o| APPROVAL : "decided by"
    USER ||--o{ APPROVAL : decides
    USER ||--o{ AUDIT_LOG : acts
```

## Key relationships (blueprint §10.1, unchanged)

```
Company 1──N Factory
Factory 1──N Warehouse
Factory 1──N Machine
Product 1──N ProductMaterial N──1 RawMaterial   (the BOM)
Warehouse 1──N Inventory
RawMaterial 1──N Inventory
Product 1──N ProductionOrder
Supplier N──N RawMaterial   (through SupplierMaterial)
Supplier 1──N PurchaseOrder
ProductionOrder → (BOM explosion) → material reservation, not a stored 1:N table
Machine 1──N MachineSensorData
Recommendation 1──1 Approval
Approval → AuditLog (via recordAudit(), not a stored FK — audit log references any entity type)
```

## Deliberate simplification vs. blueprint §10

The blueprint lists `PurchaseRequest`, `PurchaseOrder`, `GoodsReceipt` as three
entities. This prototype merges `PurchaseRequest` into `Recommendation` (the
AI-generated, human-approved request *is* the purchase request) and treats
"goods receipt" as a status transition + ledger entries on `PurchaseOrder`
rather than a separate table. See [SRS.md §6](SRS.md#6-prototype-simplifications).
