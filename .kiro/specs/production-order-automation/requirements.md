# Requirements Document: Production Order Automation

## Introduction

This document specifies requirements for an automated production order system that creates Production Orders when Sales Orders are approved. The system manages the complete production lifecycle including item specifications, resource allocation, material management, and quality control, with real-time tracking capabilities for production managers.

## Glossary

- **Sales Order**: A customer purchase order that contains items and quantities to be delivered
- **Production Order**: An internal manufacturing directive created from approved Sales Orders to manage production execution
- **Item Type**: Classification of Sales Order items (In-house Manufacturing, Outdoor/Purchase, Service Items)
- **Production Specification**: Detailed manufacturing parameters including printing, packaging, and paper cup specifications
- **BOM (Bill of Materials)**: A complete list of components and quantities required to manufacture an item
- **Material Request**: A document requesting materials from inventory based on BOM requirements
- **Production Unit**: A logical grouping of manufacturing operations (Printing, Die Cutting, Cup Forming, Lamination, Packing, QC)
- **Production Lifecycle State**: Status of a Production Order during its execution journey
- **Wastage**: Quantity of produced material discarded due to defects or quality issues
- **QC (Quality Control)**: Process of verifying produced items meet quality standards

## Requirements

### Requirement 1: Automatic Production Order Creation on Sales Order Approval

**User Story:** As a Manufacturing Manager, I want Production Orders to be automatically created when a Sales Order is approved, so that production can start immediately without manual intervention.

#### Acceptance Criteria

1. WHEN a Sales Order is approved, THE ProductionOrderCreator SHALL create a Production Order with Draft status
2. WHEN a Production Order is created from a Sales Order, THE ProductionOrderCreator SHALL copy customer information, delivery date, and company details
3. WHEN a Production Order is created, THE ProductionOrderCreator SHALL populate it with items from the Sales Order where item_type = "In-house Manufacturing"
4. IF a Sales Order has no "In-house Manufacturing" items, THEN THE ProductionOrderCreator SHALL NOT create a Production Order
5. WHEN a Production Order is created, THE System SHALL set the production_status to "Draft"

---

### Requirement 2: Production Order Item Details Capture

**User Story:** As a Production Manager, I want detailed information about each item to be captured in the Production Order, so that I have complete visibility into what needs to be produced.

#### Acceptance Criteria

1. WHEN a Production Order item is created, THE ProductionOrderItem SHALL store item_code, item_name, SKU, customer_name, and order_quantity
2. WHEN a Production Order item is created, THE ProductionOrderItem SHALL store delivery_date and priority_level (Low, Medium, High, Urgent)
3. THE ProductionOrderItem SHALL support storing sales_order_qty, qty_to_produce, and produced_qty fields
4. WHEN a Production Order is displayed, THE System SHALL show item details in a table with columns: Item Code, SKU, Item Name, Qty, Priority, Delivery Date

---

### Requirement 3: Production Specifications for Printing and Packaging

**User Story:** As a Production Supervisor, I want to specify printing and packaging parameters for each product, so that production teams know exact specifications.

#### Acceptance Criteria

1. WHEN creating a Production Specification for printing items, THE PrintingSpec SHALL capture: Size, GSM (gram per square meter), Color, Printing_Type
2. WHEN creating a Production Specification for printing items, THE PrintingSpec SHALL capture: Lamination (Yes/No), PE_Coating (Yes/No), Finish_Type (Glossy/Matte/Texture), Artwork_Version
3. WHEN creating a Production Specification for paper cup items, THE PaperCupSpec SHALL capture: Cup_Size, Wall_Type (Single/Double/Triple), Paper_GSM, PE_Type
4. WHEN creating a Production Specification for paper cup items, THE PaperCupSpec SHALL capture: Print_Color (Single/Multi)
5. WHEN a Production Order Item is created, THE System SHALL allow attaching production specifications for either printing or paper cup types

---

### Requirement 4: Production Unit Assignment

**User Story:** As a Manufacturing Manager, I want to assign different production units to handle different stages of manufacturing, so that work can be properly distributed across the factory.

#### Acceptance Criteria

1. WHEN a Production Order Item transitions to "In Production" status, THE System SHALL support assigning Production Units: Printing, Die Cutting, Cup Forming, Lamination, Packing, QC
2. WHEN a Production Unit is assigned to a Production Order Item, THE ProductionUnitAssignment SHALL store unit_code, unit_name, assigned_date, and expected_completion_date
3. WHERE multiple Production Units are required for a single item, THE System SHALL allow sequential or parallel unit assignment based on process flow
4. WHEN a Production Order Item moves through units, THE System SHALL update the production_unit_status for each unit

---

### Requirement 5: Worker, Operator, and Machine Assignment

**User Story:** As a Production Supervisor, I want to assign specific workers, operators, and machines to each production unit task, so that I know who and what is working on each item.

#### Acceptance Criteria

1. WHEN a Production Unit is assigned to a Production Order Item, THE System SHALL allow assigning Worker_Code, Operator_Name, and Machine_Asset_Id
2. WHEN a Worker is assigned, THE System SHALL validate that the Worker exists in the system and has active status
3. WHEN a Machine is assigned, THE System SHALL validate that the Machine/Asset exists in the system and is operational
4. WHEN a Production Unit task is completed, THE System SHALL record completion_date, produced_quantity, and operator_notes
5. WHEN viewing Production Order details, THE System SHALL display assigned resources in the production unit assignment table

---

### Requirement 6: Support for Multiple Sales Order Item Types

**User Story:** As a Sales Manager, I want to create Sales Orders with different item types (In-house Manufacturing, Outdoor/Purchase, Service), so that I can manage diverse product offerings.

#### Acceptance Criteria

1. WHEN a Sales Order Item is created, THE SalesOrderItemType SHALL support: In-house Manufacturing, Outdoor/Purchase, Service Items
2. WHEN a Production Order is created from a Sales Order, THE ProductionOrderCreator SHALL only include items with item_type = "In-house Manufacturing"
3. WHEN a Production Order is created, THE System SHALL ignore Outdoor/Purchase and Service Items
4. WHEN viewing a Sales Order, THE System SHALL display item_type for each item

---

### Requirement 7: Automatic Material Request Creation

**User Story:** As a Production Planner, I want Material Requests to be automatically created based on BOM when a Production Order is approved, so that materials are reserved for production.

#### Acceptance Criteria

1. WHEN a Production Order status changes to "Planned", THE MaterialRequestCreator SHALL create a Material Request with status "Draft"
2. WHEN creating a Material Request, THE MaterialRequestCreator SHALL fetch the BOM for each Production Order Item
3. WHEN a BOM exists for an item, THE MaterialRequestCreator SHALL create Material Request lines for each BOM component with required_qty = item_qty × component_qty_per_unit
4. IF a BOM does not exist for an item, THEN THE System SHALL create a Material Request line flagging the item as requiring manual BOM review
5. WHEN a Material Request is created, THE System SHALL link it to the Production Order with reference_doctype = "Production Order"

---

### Requirement 8: Production Order Lifecycle Management

**User Story:** As a Manufacturing Manager, I want to track the Production Order through its complete lifecycle, so that I can manage production flow and identify bottlenecks.

#### Acceptance Criteria

1. WHEN a Production Order is created, THE ProductionOrder status SHALL follow this progression: Draft → Planned → Material_Requested → Material_Issued → In_Production → QC_Pending → Completed → Closed
2. WHEN a Production Order transitions to "Planned", THE System SHALL validate that all items have qty_to_produce > 0
3. WHEN a Production Order transitions to "Material_Requested", THE System SHALL validate that Material Requests have been created
4. WHEN a Production Order transitions to "Material_Issued", THE System SHALL validate that material has been issued to production
5. WHEN a Production Order transitions to "In_Production", THE System SHALL update all Production Order Items to status "In Progress"
6. WHEN a Production Order Item completes QC, THE ProductionOrder SHALL transition to "QC_Pending" if any item is pending QC
7. WHEN all Production Order Items complete successfully, THE ProductionOrder status SHALL automatically update to "Completed"
8. WHEN a Production Order is completed, users SHALL be able to close it with "Closed" status for archival

---

### Requirement 9: Production Manager Dashboard with Real-time Tracking

**User Story:** As a Production Manager, I want a real-time dashboard showing production status, progress, and assigned resources, so that I can monitor and optimize production flow.

#### Acceptance Criteria

1. WHEN accessing the Production Manager Dashboard, THE Dashboard SHALL display: Production Orders by status (Draft, Planned, In Production, Completed, Delayed)
2. WHEN viewing the Dashboard, THE Dashboard SHALL show total items in production, completed items, and items pending QC
3. WHEN viewing the Dashboard, THE Dashboard SHALL display Production Units with current workload and assigned operators
4. WHEN viewing the Dashboard, THE Dashboard SHALL show items at risk of missing delivery dates (delivery_date - today ≤ 3 days)
5. WHEN viewing the Dashboard, THE Dashboard SHALL include production charts: Completion % by Production Unit, Items by Priority Level, Production Timeline vs Plan
6. WHEN viewing a Production Order from Dashboard, THE Dashboard SHALL navigate to detailed Production Order view with item-wise status
7. WHEN viewing item-wise status, THE System SHALL display: Current Production Unit, Assigned Worker, Progress %, Estimated Completion Time

---

### Requirement 10: Automatic Inventory Updates

**User Story:** As an Inventory Manager, I want inventory to be automatically updated with produced quantities and wastage, so that inventory records are always accurate.

#### Acceptance Criteria

1. WHEN a Production Order Item status changes to "Completed" and QC passes, THE InventoryUpdater SHALL increase stock for item_code by produced_qty
2. WHEN wastage is recorded during production, THE InventoryUpdater SHALL NOT increase stock for the wastage quantity
3. WHEN a Production Order Item fails QC, THE InventoryUpdater SHALL record rejected_qty but not increase stock
4. WHEN inventory is updated, THE System SHALL create Stock Entry documents with reference_doctype = "Production Order"
5. WHEN viewing Item master, THE System SHALL display produced_quantity, wastage_quantity, and qc_reject_quantity for each production cycle

---

### Requirement 11: Production Specifications Data Persistence

**User Story:** As a Quality Assurance Lead, I want production specifications to be reliably stored and retrievable, so that I can verify compliance with specifications.

#### Acceptance Criteria

1. WHEN a Production Specification is created with specification_type = "Printing", THE System SHALL require and store: Size, GSM, Color, Printing_Type, Lamination, PE_Coating, Finish_Type, Artwork_Version
2. WHEN a Production Specification is created with specification_type = "Paper Cup", THE System SHALL require and store: Cup_Size, Wall_Type, Paper_GSM, PE_Type, Print_Color
3. WHERE Production Specification is linked to a Production Order Item, THE System SHALL prevent modification of specifications during In Production status
4. WHEN retrieving Production Specifications, THE System SHALL return exact values without loss of precision
5. WHEN a Production Order is amended, THE System SHALL preserve original specifications in version history

---

### Requirement 12: Production Order State Transitions with Validation

**User Story:** As a Manufacturing Manager, I want state transitions to be validated before execution, so that invalid workflows are prevented.

#### Acceptance Criteria

1. WHEN attempting to transition a Production Order from Draft to Planned, THE System SHALL validate: all items have specifications, at least one production unit is planned
2. WHEN attempting to transition from Planned to Material_Requested, THE System SHALL validate: Material Requests exist for all items
3. WHEN attempting to transition from Material_Issued to In_Production, THE System SHALL validate: all materials are issued to warehouse location
4. WHEN attempting to transition from In_Production to QC_Pending, THE System SHALL validate: all items have completed their assigned production units
5. IF validation fails, THEN THE System SHALL display error messages explaining why transition cannot proceed

---

### Requirement 13: Production Unit Workflow Coordination

**User Story:** As a Production Floor Supervisor, I want to coordinate work between production units efficiently, so that bottlenecks are minimized.

#### Acceptance Criteria

1. WHEN a Production Order Item is in a Production Unit, THE System SHALL track: start_datetime, current_progress_%, and estimated_completion_datetime
2. WHEN one Production Unit completes work on an item, THE System SHALL automatically notify the next assigned Production Unit
3. WHEN a Production Order Item moves to the next Production Unit, THE System SHALL update sequence_number and set status to "Pending"
4. WHEN a Production Unit rejects an item (QC fails during unit processing), THE System SHALL allow routing back to the previous unit or rejecting to rework

---

### Requirement 14: Wastage and QC Recording

**User Story:** As a QC Inspector, I want to record wastage and QC results, so that quality metrics are tracked accurately.

#### Acceptance Criteria

1. WHEN a Production Order Item completes QC, THE QCRecorder SHALL record: qc_result (Passed/Failed/Rework), defect_count, defect_description, qc_inspector_name, qc_datetime
2. WHEN a Production Order Item is completed with wastage, THE QCRecorder SHALL record: wastage_qty, wastage_reason (Defect/Material Shortage/Process Error/Other), wastage_percentage = wastage_qty / (produced_qty + wastage_qty)
3. IF wastage_percentage > acceptable_wastage_threshold, THEN THE System SHALL flag item for Root Cause Analysis
4. WHEN QC result is Rework, THE System SHALL revert the Production Order Item to "In Production" for reprocessing

---

### Requirement 15: Sales Order Approval Hook Integration

**User Story:** As a System Administrator, I want the system to integrate with Sales Order approval workflow, so that Production Orders are created at the right time.

#### Acceptance Criteria

1. WHEN a Sales Order is submitted and approval is required, THE ApprovalHook SHALL create a workflow step requiring Manufacturing Manager approval
2. WHEN a Manufacturing Manager approves the Sales Order, THE ProductionOrderCreator SHALL immediately create a Production Order
3. WHEN a Sales Order is rejected, THE System SHALL NOT create a Production Order
4. WHEN a Sales Order is amended after approval, THE System SHALL handle Production Order updates appropriately based on change type

---

## Common Acceptance Criteria Patterns

### Data Integrity (Invariants)
- Production Order quantities: qty_to_produce = total of all production unit quantities produced
- Inventory accuracy: stock_increase = produced_qty - wastage_qty for completed items
- Material balance: material_issued >= material_required (sum of BOM quantities)

### Round-Trip Properties
- Production Order serialization: create_production_order(sales_order) → serialize → deserialize → equivalent_production_order
- Material Request creation: production_order_item.qty → BOM_lookup → material_request.qty → should match production requirement

### Idempotence
- Production Order creation: Creating Production Order twice from same Sales Order should result in single Production Order (idempotent)
- Status updates: Marking item as Completed twice should not change state

### Metamorphic Properties
- Wastage calculation: produced_qty + wastage_qty + rejected_qty <= sales_order_qty
- Timeline: material_issued_date <= in_production_date <= qc_pending_date <= completed_date
