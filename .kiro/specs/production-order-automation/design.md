# Design Document: Production Order Automation

## Overview

The Production Order Automation system is a comprehensive manufacturing execution platform that automates the entire production lifecycle from Sales Order approval to inventory completion. It manages production specifications, resource allocation, material tracking, and quality control with real-time progress monitoring.

### Key Objectives

- Eliminate manual Production Order creation through automated triggering on Sales Order approval
- Capture detailed production specifications for printing and packaging items
- Distribute work across production units with worker and machine assignments
- Track material flow from Material Request through production to inventory
- Manage complete Production Order lifecycle with state validation
- Provide real-time dashboards for production managers
- Record quality control results and wastage metrics

### System Scope

The system covers:
- Production Order creation and lifecycle management
- Production specifications storage and retrieval
- Production Unit workflow coordination
- Material Request generation from BOMs
- QC recording and wastage tracking
- Automatic inventory updates on completion
- State machine with validation rules

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Paperware Manufacturing System               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Sales      │  │  Production  │  │  Production  │          │
│  │   Order      │─→│   Order      │─→│   Unit       │          │
│  │  Approval    │  │  Creator     │  │ Coordinator  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↑                ↓                     ↓                │
│         │         ┌──────────────┐   ┌─────────────────┐       │
│         │         │  Production  │   │  Material       │       │
│         │         │ Specification│   │  Request        │       │
│         │         │   Manager    │   │  Generator      │       │
│         │         └──────────────┘   └─────────────────┘       │
│         │                                    ↓                  │
│         │                            ┌─────────────────┐       │
│         │                            │  Inventory      │       │
│         │                            │  Updater        │       │
│         └────────────────────────────┴─────────────────┘       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Real-time Dashboard & Reporting Layer             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Sales Order Integration**
   - Approval hook for automatic Production Order creation
   - Field mapping: Customer, Company, Delivery Date, Items

2. **BOM Integration**
   - Fetch BOMs for each Production Order Item
   - Calculate material requirements

3. **Material Request System**
   - Auto-create on "Planned" status
   - Receive link reference

4. **Inventory System**
   - Stock Entry creation for produced items
   - Wastage tracking

5. **Asset Management**
   - Machine/Asset validation
   - Operational status checks

6. **Workflow System**
   - Manufacturing Manager approval
   - State transition notifications

---

## Components and Interfaces

### 1. Production Order DocType

**Purpose**: Core document managing production execution from creation to completion

**Key Fields**:
- `naming_series`: Series format (PO-YYYY-)
- `sales_order`: Reference to source Sales Order
- `customer`: Customer name
- `company`: Company code
- `delivery_date`: Required delivery date
- `production_status`: Lifecycle state
- `planned_date`: Target production start
- `items` (table): Production Order Items

**Relationships**:
- 1:N with Production Order Item
- 1:1 with Sales Order
- 1:1 with Material Request (generated)

### 2. Production Order Item DocType

**Purpose**: Individual item-level production detail

**Key Fields**:
- `item_code`: SKU reference
- `item_name`: Display name
- `customer_name`: Customer reference
- `sales_order_qty`: Original ordered quantity
- `qty_to_produce`: Target quantity for production
- `produced_qty`: Actually produced
- `priority_level`: Low/Medium/High/Urgent
- `delivery_date`: Item-specific delivery
- `item_status`: Current state (Draft, In Progress, QC Pending, Completed)
- `production_specification`: Link to specification
- `unit_assignments` (table): Assigned Production Units

**Calculations**:
- `produced_qty` = sum of all production unit outputs
- `wastage_qty` = tracked from QC recording
- `available_qty` = produced_qty - wastage_qty

### 3. Production Specification DocType

**Purpose**: Detailed manufacturing parameters

**Subtypes**:
- **Printing Specification**
  - `size`: Paper/Material size
  - `gsm`: Gram per square meter
  - `color`: Color specification
  - `printing_type`: Offset/Digital/Flexo/Screen
  - `lamination`: Yes/No
  - `pe_coating`: Yes/No
  - `finish_type`: Glossy/Matte/Texture
  - `artwork_version`: Version reference

- **Paper Cup Specification**
  - `cup_size`: Standard sizes
  - `wall_type`: Single/Double/Triple
  - `paper_gsm`: Paper weight
  - `pe_type`: PE coating type
  - `print_color`: Single/Multi-color

**Versioning**: Original specification stored with amendment history preserved

### 4. Production Unit Assignment DocType

**Purpose**: Track work distribution across manufacturing stations

**Key Fields**:
- `production_order_item`: Reference to parent item
- `unit_code`: Unit identifier (Printing, Die Cutting, Cup Forming, etc.)
- `unit_name`: Display name
- `assigned_date`: Assignment timestamp
- `expected_completion_date`: SLA date
- `worker_code`: Assigned worker
- `operator_name`: Operator reference
- `machine_asset_id`: Equipment reference
- `start_datetime`: When work begins
- `current_progress_percent`: 0-100
- `estimated_completion_datetime`: Updated estimate
- `unit_status`: Pending/In Progress/Completed/Rejected
- `completion_date`: Actual completion
- `produced_quantity`: Output from this unit
- `operator_notes`: Work notes

**Sequencing**: Multiple units can be sequential or parallel based on process flow

### 5. QC Recording DocType

**Purpose**: Quality control outcomes and wastage tracking

**Key Fields**:
- `production_order_item`: Reference to item
- `qc_result`: Passed/Failed/Rework
- `defect_count`: Number of defects
- `defect_description`: Quality issue details
- `qc_inspector_name`: Inspector who performed QC
- `qc_datetime`: QC execution time
- `wastage_qty`: Discarded quantity
- `wastage_reason`: Root cause classification
- `wastage_percentage`: Calculated metric
- `acceptable_threshold`: Configurable limit
- `rca_required`: Flag for Root Cause Analysis

**Calculations**:
- `wastage_percentage` = wastage_qty / (produced_qty + wastage_qty)

---

## Data Flow and State Machine

### Production Order Lifecycle

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌─────────────┐
│ Draft   │────→│ Planned │────→│ Material     │────→│ Material    │
│         │     │         │     │ Requested    │     │ Issued      │
└─────────┘     └─────────┘     └──────────────┘     └─────────────┘
                       ↓                                      ↓
                   ┌─────────────┐                   ┌─────────────┐
                   │ Validation: │                   │ Validation: │
                   │ qty > 0,    │                   │ All items   │
                   │ specs exist │                   │ issued      │
                   └─────────────┘                   └─────────────┘
                                                             ↓
┌─────────────┐     ┌─────────┐     ┌──────────────┐     ┌──────────┐
│ Closed      │←────│ Completed  │←──│ QC Pending   │←────│ In       │
│             │     │ (auto)     │   │              │     │ Production
└─────────────┘     └─────────────┘   └──────────────┘     └──────────┘
(archived)              ↑
                    All items
                    complete
```

### State Transition Validations

| From State | To State | Validations Required |
|---|---|---|
| Draft | Planned | All items have qty_to_produce > 0; All items have production specs |
| Planned | Material_Requested | Material Requests created for all items |
| Material_Requested | Material_Issued | All materials issued to warehouse |
| Material_Issued | In_Production | All Production Units assigned; Materials at production location |
| In_Production | QC_Pending | All items completed their production units |
| QC_Pending | Completed | All QC passes or rework approved |
| Completed | Closed | User approval for archival |

### Item-Level State Progression

Each Production Order Item follows:
- **Draft**: Initial state on creation
- **Planned**: Assigned to production units
- **In Progress**: Currently being processed
- **QC Pending**: Awaiting quality check
- **Completed**: QC passed, ready for inventory
- **Failed**: QC failed, rework or rejection

---

## Material Flow and Inventory Updates

### Material Request Generation

```
Production Order (Planned)
        ↓
    For each item:
        ├─ Fetch BOM
        ├─ For each component: qty_required = item_qty × component_qty_per_unit
        ├─ Create Material Request Line
        └─ Link to Production Order
        ↓
Material Request (Draft)
```

### Inventory Update Logic

```
Production Order Item (Completed) + QC (Passed)
        ↓
    Calculate:
    ├─ available_qty = produced_qty - wastage_qty
    ├─ rejected_qty (from QC result)
    └─ inventory_increase = available_qty
        ↓
Create Stock Entry:
    ├─ Type: Material Receipt
    ├─ Reference: Production Order
    ├─ Item: item_code
    ├─ Quantity: inventory_increase
    └─ Location: Finished Goods
        ↓
Update Item Master:
    ├─ produced_quantity += inventory_increase
    ├─ wastage_quantity += wastage_qty
    └─ qc_reject_quantity += rejected_qty
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Production Order Creation Copies Required Fields

*For any* Sales Order with "In-house Manufacturing" items that is approved, the created Production Order SHALL contain the same customer, company, and delivery_date as the source Sales Order.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: In-house Manufacturing Item Filtering

*For any* Sales Order containing mixed item types (In-house Manufacturing, Outdoor/Purchase, Service), the generated Production Order SHALL only include Production Order Items corresponding to items with item_type = "In-house Manufacturing".

**Validates: Requirements 1.3, 6.2, 6.3**

### Property 3: Production Order Draft Status on Creation

*For any* Sales Order approval event, the created Production Order SHALL have production_status = "Draft".

**Validates: Requirements 1.5**

### Property 4: Production Specification Field Persistence

*For any* Production Specification (Printing or Paper Cup type), retrieving the specification SHALL return all stored fields with exact values matching the creation input (round-trip property).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 11.1, 11.2, 11.4**

### Property 5: Material Request Calculation

*For any* Production Order Item with qty_to_produce = Q and an associated BOM with component C having qty_per_unit = U, the generated Material Request line for component C SHALL have required_qty = Q × U.

**Validates: Requirements 7.3**

### Property 6: Material Request Creation on Planned

*For any* Production Order transitioning to "Planned" status, the system SHALL create at least one Material Request with status "Draft" linked to that Production Order.

**Validates: Requirements 7.1, 7.5**

### Property 7: Valid State Transitions Only

*For any* Production Order, attempting to transition from one state to another SHALL only succeed if all validation rules for that transition are satisfied (e.g., Draft → Planned requires qty_to_produce > 0).

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 12.1, 12.2, 12.3, 12.4**

### Property 8: Inventory Increase Accuracy

*For any* Production Order Item with produced_qty = P, wastage_qty = W, and QC result = Passed, the resulting Stock Entry SHALL increase inventory by (P - W), and inventory SHALL NOT increase for wastage or rejected quantities.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 9: Wastage Percentage Calculation

*For any* QC recording with wastage_qty = W and produced_qty = P, the calculated wastage_percentage SHALL equal W / (P + W) with no precision loss.

**Validates: Requirements 14.2**

### Property 10: Production Unit Assignment Storage

*For any* Production Unit Assignment, all required fields (unit_code, unit_name, assigned_date, expected_completion_date, worker_code, operator_name, machine_asset_id) SHALL be stored and retrievable without loss of data.

**Validates: Requirements 4.2, 5.1, 13.1**

### Property 11: Sequential/Parallel Unit Processing

*For any* Production Order Item with multiple assigned Production Units, the system SHALL support both sequential execution (one unit completes before next starts) and parallel execution (multiple units work simultaneously), with status tracking for each unit.

**Validates: Requirements 4.3, 4.4, 13.3**

### Property 12: QC Rework State Reversion

*For any* Production Order Item with QC result = "Rework", the item_status SHALL revert to "In Production" and be available for reprocessing.

**Validates: Requirements 14.4**

### Property 13: Worker and Asset Validation

*For any* attempt to assign a worker or machine to a Production Unit, if the worker_code does not exist in the system OR the worker status is not active, the assignment SHALL be rejected with an error message. Similarly for machine/asset assignments.

**Validates: Requirements 5.2, 5.3**

### Property 14: No Production Order Without In-house Items

*For any* Sales Order containing only Outdoor/Purchase or Service items (no "In-house Manufacturing" items), the system SHALL NOT create a Production Order.

**Validates: Requirements 1.4, 6.2**

### Property 15: Production Specification Immutability During Production

*For any* Production Order Item in "In Production" status with an attached Production Specification, attempts to modify that specification SHALL be rejected, and the specification SHALL remain unchanged.

**Validates: Requirements 11.3**

### Property 16: Item Status Update on Production Start

*For any* Production Order transitioning to "In_Production" status, ALL Production Order Items in that Production Order SHALL have their item_status updated to "In Progress".

**Validates: Requirements 8.5**

### Property 17: Automatic Completion on Item Completion

*For any* Production Order where all Production Order Items have item_status = "Completed" with QC passes, the Production Order production_status SHALL automatically transition to "Completed".

**Validates: Requirements 8.7**

### Property 18: Sales Order Rejection Prevents Production Order

*For any* Sales Order that is rejected (not approved), no Production Order SHALL be created, and existing Production Orders for that Sales Order SHALL not be modified.

**Validates: Requirements 15.3**

### Property 19: Amendment Specification Versioning

*For any* Production Order amendment, the original Production Specification values SHALL be preserved in version history, and modifications SHALL be tracked with amendment reason.

**Validates: Requirements 11.5**

### Property 20: Threshold-Based RCA Flagging

*For any* QC recording where wastage_percentage > acceptable_wastage_threshold, the system SHALL automatically flag the item for Root Cause Analysis.

**Validates: Requirements 14.3**

---

## Error Handling

### Validation Failures

**State Transition Errors**:
- Status: HTTP 400 Bad Request
- Message: "Cannot transition to {state}: {reason}"
- Reason examples:
  - "qty_to_produce must be > 0 for all items"
  - "Production specifications required for all items"
  - "Material Requests not yet created"

**Resource Assignment Errors**:
- Status: HTTP 400 Bad Request
- Messages:
  - "Worker {worker_code} does not exist or is inactive"
  - "Machine {machine_id} does not exist or is not operational"
  - "Duplicate assignment: Unit already assigned to this item"

**Data Integrity Errors**:
- Status: HTTP 409 Conflict
- Messages:
  - "Cannot modify specification while item is In Production"
  - "Cannot delete Production Order Item with completed units"

### Recovery Mechanisms

1. **Incomplete Material Requests**
   - Automatically retry every 5 minutes
   - Log attempts for manual review
   - Notify Manufacturing Manager after 3 failures

2. **Failed BOM Lookups**
   - Create Material Request line flagged as "Manual BOM Review Required"
   - Do not block Production Order transition
   - Alert Planning team

3. **Invalid Asset References**
   - Prevent assignment immediately
   - Suggest list of operational machines
   - Allow admin override with audit trail

4. **Concurrent Modifications**
   - Implement optimistic locking with version numbers
   - Retry with exponential backoff
   - Lock for editing during state transitions

---

## Testing Strategy

This feature requires comprehensive property-based testing for core logic and example-based tests for integration points.

### Property-Based Testing (100+ iterations each)

**Core Logic Tests**:
- Production Order creation from Sales Orders with various item type combinations
- Material Request calculation with random BOMs and quantities
- State transition validation with invalid and valid inputs
- Inventory calculation with produced, wastage, and rejected quantities
- Specification field storage and retrieval round-trips
- Wastage percentage calculations with edge cases

**Resource Assignment Tests**:
- Worker/machine validation with mock system records
- Unit assignment sequencing with various process flows
- Status tracking across multiple units

**Test Execution**:
- Framework: Python unittest with hypothesis for generation
- Use fixtures for common Production Order/Item/Specification setup
- Mock external systems (BOM, Asset, Inventory) to test pure logic
- Minimum 100 iterations per property
- Tag format: `Feature: production-order-automation, Property {number}: {title}`

### Example-Based Unit Tests

**Integration Tests** (1-3 examples each):
- Sales Order approval hook triggering Production Order creation
- Material Request generation from real BOMs
- Workflow notification on status changes
- Stock Entry creation and inventory posting
- Dashboard data aggregation

**Edge Cases**:
- Production Orders with zero items
- BOMs with missing components
- Rework cycles (Rework → In Production → Completed)
- Concurrent item processing in same Production Order
- Amendment with production already started

### Manual Testing Checklist

- [ ] User can create Production Order from approved Sales Order
- [ ] Dashboard displays all status categories correctly
- [ ] Real-time progress updates on Production Unit completion
- [ ] Material Request created with correct quantities
- [ ] Inventory correctly updated after QC pass
- [ ] Wastage flagged for RCA when exceeding threshold
- [ ] State transition prevented when validation fails
- [ ] Error messages clearly explain issues

---

## Dashboard Design

### Production Manager Dashboard

**Key Metrics (Real-time)**:
- Total Production Orders by Status (Draft, Planned, In Production, Completed, Delayed)
- Items in Production vs. Plan
- Production Units Current Workload
- Items at Risk (delivery_date - today ≤ 3 days)

**Charts**:
- Completion % by Production Unit (bar chart)
- Items by Priority Level (pie chart)
- Production Timeline vs. Plan (Gantt chart)

**Data Refresh**: Every 30 seconds via WebSocket or polling

**Navigation**: Click on Production Order to view detailed item-level tracking

### Item-Level Tracking View

**Display per Production Order Item**:
- Current Production Unit Assignment
- Assigned Worker and Machine
- Progress % (0-100)
- Estimated Completion Time
- Historical unit assignments (completed)

---

## Implementation Considerations

### Database Schema

**Production Order Indexes**:
- Composite: (sales_order, production_status)
- Composite: (customer, delivery_date)
- Single: production_status (for dashboard queries)

**Production Order Item Indexes**:
- Single: production_order (join queries)
- Single: item_status (filtering)

**Production Unit Assignment Indexes**:
- Composite: (production_order_item, unit_status)
- Single: worker_code (availability tracking)
- Single: machine_asset_id (equipment utilization)

**QC Recording Indexes**:
- Single: production_order_item (history)
- Single: qc_result (statistics)

### Caching Strategy

- Production Unit list (rarely changes): 24-hour TTL
- Worker availability: 1-hour TTL
- BOM data: On-access with invalidation on BOM change
- Dashboard aggregates: 5-minute TTL with real-time push for active changes

### Performance Targets

- Production Order creation: < 500ms
- Material Request generation: < 2s for 100-item Production Order
- Dashboard load: < 3s
- State transition: < 1s with validations

### Audit Trail

- Track all status transitions with timestamp and user
- Preserve original Production Specification versions
- Log all validation failures (for debugging)
- Record all material and QC corrections

---

## Security and Permissions

### Role-Based Access

| Role | Create | Submit | Edit | Cancel | Approve |
|---|---|---|---|---|---|
| Manufacturing Manager | Yes | Yes | Yes | Yes | Yes |
| Manufacturing User | No | Yes | Limited | No | No |
| QC Inspector | Limited | Yes | Limited | No | No |
| Planning Manager | No | No | No | No | No |
| Production Floor | No | No | View Only | No | No |

### Data Validation

- Validate all foreign key references before storing
- Reject non-numeric quantities
- Enforce enum values for status fields
- Sanitize text fields for special characters

---

## Dependencies and Prerequisites

**Frappe Framework** (assumed available):
- DocType system
- Workflow engine
- Stock Entry creation
- BOM lookup
- Asset management

**System Configuration**:
- Manufacturing Manager role must exist
- Production Units must be defined
- Acceptable wastage thresholds configured
- Warehouse locations configured for material issuance

---

## Future Enhancements

- Machine Learning for estimated completion time prediction
- Multi-language support for specifications
- Mobile app for production floor status updates
- Advanced scheduling with capacity optimization
- Integration with Quality Management System (QMS)
