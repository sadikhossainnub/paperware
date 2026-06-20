# Implementation Plan: Production Order Automation

## Overview

This implementation plan breaks down the Production Order Automation system into discrete, actionable coding tasks. The system automates the entire production lifecycle from Sales Order approval to inventory completion, managing production specifications, resource allocation, material tracking, and quality control with real-time progress monitoring.

The implementation follows a bottom-up approach: core data models and utilities first, then business logic components, followed by integration with Frappe workflows, and finally the dashboard and UI components. All code will be written in Python, leveraging the Frappe framework's DocType system.

## Tasks

- [ ] 1. Set up project structure and core DocTypes
  - [x] 1.1 Create Production Order DocType with core fields
    - Create `production_order.json` with fields: naming_series, sales_order, customer, company, delivery_date, production_status, planned_date
    - Create `production_order.py` with basic class structure
    - Add status field with options: Draft, Planned, Material_Requested, Material_Issued, In_Production, QC_Pending, Completed, Closed
    - Set up naming series format: PO-YYYY-
    - _Requirements: 1.1, 1.2, 1.5, 8.1_

  - [x] 1.2 Create Production Order Item DocType
    - Create `production_order_item.json` with fields: item_code, item_name, customer_name, sales_order_qty, qty_to_produce, produced_qty, priority_level, delivery_date, item_status, production_specification
    - Create `production_order_item.py` with basic class structure
    - Add priority_level options: Low, Medium, High, Urgent
    - Add item_status options: Draft, Planned, In Progress, QC Pending, Completed, Failed
    - Set up child table relationship to Production Order
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 Create Production Specification DocType
    - Create `production_specification.json` with base fields: specification_type, item_code
    - Add printing-specific fields: size, gsm, color, printing_type, lamination, pe_coating, finish_type, artwork_version
    - Add paper cup-specific fields: cup_size, wall_type, paper_gsm, pe_type, print_color
    - Create `production_specification.py` with validation logic for required fields based on specification_type
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.1, 11.2_

  - [x] 1.4 Create Production Unit Assignment DocType
    - Create `production_unit_assignment.json` with fields: production_order_item, unit_code, unit_name, assigned_date, expected_completion_date, worker_code, operator_name, machine_asset_id, start_datetime, current_progress_percent, estimated_completion_datetime, unit_status, completion_date, produced_quantity, operator_notes
    - Create `production_unit_assignment.py` with basic class structure
    - Add unit_code options: Printing, Die Cutting, Cup Forming, Lamination, Packing, QC
    - Add unit_status options: Pending, In Progress, Completed, Rejected
    - _Requirements: 4.1, 4.2, 5.1_

  - [-] 1.5 Create QC Recording DocType
    - Create `qc_recording.json` with fields: production_order_item, qc_result, defect_count, defect_description, qc_inspector_name, qc_datetime, wastage_qty, wastage_reason, wastage_percentage, acceptable_threshold, rca_required
    - Create `qc_recording.py` with basic class structure
    - Add qc_result options: Passed, Failed, Rework
    - Add wastage_reason options: Defect, Material Shortage, Process Error, Other
    - _Requirements: 14.1, 14.2_

- [ ] 2. Implement Production Order creation logic
  - [ ] 2.1 Create Sales Order approval hook
    - Implement `on_submit` hook in Sales Order DocType to trigger Production Order creation
    - Add validation to check for "In-house Manufacturing" items
    - Call Production Order creator function when Sales Order is approved
    - _Requirements: 1.1, 15.1, 15.2_

  - [ ] 2.2 Implement Production Order creator function
    - Create `create_production_order_from_sales_order()` function in `production_order.py`
    - Copy customer, company, delivery_date from Sales Order
    - Filter Sales Order items where item_type = "In-house Manufacturing"
    - Create Production Order with status = "Draft"
    - Return None if no In-house Manufacturing items found
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.2, 6.3_

  - [ ]* 2.3 Write property test for Production Order creation
    - **Property 1: Production Order Creation Copies Required Fields**
    - **Property 3: Production Order Draft Status on Creation**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
    - Generate random Sales Orders with various customer, company, delivery_date values
    - Verify created Production Order has same values
    - Verify production_status is always "Draft"

  - [ ]* 2.4 Write property test for In-house Manufacturing filtering
    - **Property 2: In-house Manufacturing Item Filtering**
    - **Property 14: No Production Order Without In-house Items**
    - **Validates: Requirements 1.3, 1.4, 6.2, 6.3**
    - Generate Sales Orders with mixed item types (In-house Manufacturing, Outdoor/Purchase, Service)
    - Verify only In-house Manufacturing items appear in Production Order
    - Verify no Production Order created when all items are Outdoor/Purchase or Service

  - [ ] 2.5 Implement Production Order Item population
    - Create `populate_production_order_items()` function
    - For each In-house Manufacturing item in Sales Order, create Production Order Item
    - Copy item_code, item_name, customer_name, sales_order_qty, priority_level, delivery_date
    - Initialize qty_to_produce = sales_order_qty, produced_qty = 0, item_status = "Draft"
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Checkpoint - Ensure basic Production Order creation works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Production Specifications management
  - [ ] 4.1 Create specification field validation logic
    - Implement `validate()` method in `production_specification.py`
    - Check if specification_type is "Printing" and validate required printing fields
    - Check if specification_type is "Paper Cup" and validate required paper cup fields
    - Raise validation error with clear message if required fields are missing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.1, 11.2_

  - [ ]* 4.2 Write property test for specification field persistence
    - **Property 4: Production Specification Field Persistence**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 11.1, 11.2, 11.4**
    - Generate random Printing and Paper Cup specifications with all fields
    - Save specification, retrieve it, verify all fields match exactly (round-trip)
    - Test with various data types and edge values

  - [ ] 4.3 Implement specification immutability during production
    - Add `before_save()` hook in `production_specification.py`
    - Check if linked Production Order Item has status "In Progress"
    - Prevent modification if item is in production, raise error with message
    - Allow modification if item is Draft or Planned
    - _Requirements: 11.3_

  - [ ]* 4.4 Write property test for specification immutability
    - **Property 15: Production Specification Immutability During Production**
    - **Validates: Requirements 11.3**
    - Create specification linked to Production Order Item in various states
    - Attempt modification when status is "In Production"
    - Verify modification is rejected and specification unchanged

  - [ ] 4.5 Implement specification versioning for amendments
    - Add version history tracking in `production_specification.py`
    - Create `save_version_history()` function to store original values
    - Track amendment_reason field
    - Preserve original values in separate table or JSON field
    - _Requirements: 11.5_

  - [ ]* 4.6 Write property test for amendment versioning
    - **Property 19: Amendment Specification Versioning**
    - **Validates: Requirements 11.5**
    - Create specification, amend it multiple times
    - Verify original values preserved in version history
    - Verify each amendment has reason tracked

- [ ] 5. Implement Material Request generation
  - [ ] 5.1 Create Material Request generator function
    - Create `generate_material_request()` function in `production_order.py`
    - Trigger when Production Order status changes to "Planned"
    - Fetch BOM for each Production Order Item
    - Create Material Request document with status "Draft"
    - Link Material Request to Production Order
    - _Requirements: 7.1, 7.5_

  - [ ] 5.2 Implement BOM-based material calculation
    - Create `calculate_material_requirements()` function
    - For each Production Order Item, fetch its BOM
    - For each BOM component: required_qty = item_qty × component_qty_per_unit
    - Create Material Request line with calculated required_qty
    - Handle missing BOMs by flagging for manual review
    - _Requirements: 7.2, 7.3, 7.4_

  - [ ]* 5.3 Write property test for material calculation
    - **Property 5: Material Request Calculation**
    - **Validates: Requirements 7.3**
    - Generate random BOMs with various component quantities
    - Generate Production Order Items with various qty_to_produce
    - Verify required_qty = qty_to_produce × component_qty_per_unit for each component
    - Test with edge cases (zero quantities, very large quantities)

  - [ ]* 5.4 Write property test for Material Request creation
    - **Property 6: Material Request Creation on Planned**
    - **Validates: Requirements 7.1, 7.5**
    - Create Production Order with various items
    - Transition to "Planned" status
    - Verify at least one Material Request created with status "Draft"
    - Verify Material Request linked to Production Order

- [ ] 6. Implement Production Order state machine
  - [ ] 6.1 Create state transition validation framework
    - Create `validate_state_transition()` function in `production_order.py`
    - Define validation rules for each state transition
    - Return validation errors with clear messages if rules not met
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 12.1, 12.2, 12.3, 12.4_

  - [ ] 6.2 Implement Draft to Planned transition validation
    - Check all items have qty_to_produce > 0
    - Check all items have production specifications attached
    - Check at least one production unit is planned
    - Raise error if validation fails
    - _Requirements: 8.2, 12.1_

  - [ ] 6.3 Implement Planned to Material_Requested transition validation
    - Check Material Requests exist for all items
    - Verify Material Request status is not "Cancelled"
    - _Requirements: 8.3, 12.2_

  - [ ] 6.4 Implement Material_Issued to In_Production transition
    - Check all materials issued to warehouse location
    - Update all Production Order Items to status "In Progress"
    - _Requirements: 8.4, 8.5, 12.3_

  - [ ] 6.5 Implement In_Production to QC_Pending transition validation
    - Check all Production Order Items have completed their assigned production units
    - Verify all Production Unit Assignments have unit_status = "Completed"
    - _Requirements: 8.6, 12.4_

  - [ ] 6.6 Implement automatic completion logic
    - Create `check_and_auto_complete()` function
    - Called when Production Order Item completes QC
    - Check if all items have item_status = "Completed" with QC passes
    - Automatically transition Production Order to "Completed" status
    - _Requirements: 8.7_

  - [ ]* 6.7 Write property test for valid state transitions
    - **Property 7: Valid State Transitions Only**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 12.1, 12.2, 12.3, 12.4**
    - Generate Production Orders in various states
    - Attempt transitions with valid and invalid conditions
    - Verify only valid transitions succeed
    - Verify appropriate error messages for invalid transitions

  - [ ]* 6.8 Write property test for automatic completion
    - **Property 17: Automatic Completion on Item Completion**
    - **Validates: Requirements 8.7**
    - Create Production Order with multiple items
    - Complete all items with QC passes
    - Verify Production Order automatically transitions to "Completed"

  - [ ]* 6.9 Write property test for item status update on production start
    - **Property 16: Item Status Update on Production Start**
    - **Validates: Requirements 8.5**
    - Create Production Order with multiple items
    - Transition to "In_Production"
    - Verify all items have item_status = "In Progress"

- [ ] 7. Checkpoint - Ensure state machine and material requests work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Production Unit workflow
  - [ ] 8.1 Create Production Unit Assignment logic
    - Create `assign_production_unit()` function in `production_unit_assignment.py`
    - Validate worker_code exists and is active
    - Validate machine_asset_id exists and is operational
    - Set assigned_date to current datetime
    - Initialize unit_status = "Pending"
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3_

  - [ ]* 8.2 Write property test for worker and asset validation
    - **Property 13: Worker and Asset Validation**
    - **Validates: Requirements 5.2, 5.3**
    - Create mock worker and asset databases
    - Attempt assignments with invalid/inactive workers
    - Attempt assignments with invalid/non-operational machines
    - Verify assignments are rejected with appropriate error messages

  - [ ] 8.3 Implement Production Unit progress tracking
    - Add `update_progress()` function in `production_unit_assignment.py`
    - Update current_progress_percent (0-100)
    - Update estimated_completion_datetime based on progress
    - Track start_datetime when work begins
    - _Requirements: 13.1_

  - [ ] 8.4 Implement Production Unit completion logic
    - Create `complete_production_unit()` function
    - Set unit_status = "Completed"
    - Record completion_date, produced_quantity, operator_notes
    - Notify next Production Unit in sequence
    - Update Production Order Item produced_qty
    - _Requirements: 4.4, 5.4, 13.2_

  - [ ]* 8.5 Write property test for sequential/parallel unit processing
    - **Property 11: Sequential/Parallel Unit Processing**
    - **Validates: Requirements 4.3, 4.4, 13.3**
    - Create Production Order Items with multiple assigned units
    - Test sequential execution (one completes before next starts)
    - Test parallel execution (multiple units work simultaneously)
    - Verify status tracking for each unit

  - [ ]* 8.6 Write property test for Production Unit Assignment storage
    - **Property 10: Production Unit Assignment Storage**
    - **Validates: Requirements 4.2, 5.1, 13.1**
    - Generate random Production Unit Assignments with all fields
    - Save assignment, retrieve it, verify all fields stored correctly

- [ ] 9. Implement QC recording and wastage tracking
  - [ ] 9.1 Create QC recording function
    - Create `record_qc_result()` function in `qc_recording.py`
    - Record qc_result, defect_count, defect_description, qc_inspector_name, qc_datetime
    - Calculate wastage_percentage = wastage_qty / (produced_qty + wastage_qty)
    - Check if wastage_percentage > acceptable_threshold, set rca_required flag
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ]* 9.2 Write property test for wastage percentage calculation
    - **Property 9: Wastage Percentage Calculation**
    - **Validates: Requirements 14.2**
    - Generate random wastage_qty and produced_qty values
    - Verify wastage_percentage = wastage_qty / (produced_qty + wastage_qty)
    - Test with edge cases (zero wastage, zero production, equal values)
    - Verify no precision loss

  - [ ]* 9.3 Write property test for threshold-based RCA flagging
    - **Property 20: Threshold-Based RCA Flagging**
    - **Validates: Requirements 14.3**
    - Generate QC recordings with various wastage_percentage values
    - Set acceptable_threshold to various values
    - Verify rca_required flag set when wastage_percentage > threshold

  - [ ] 9.4 Implement QC rework logic
    - Create `handle_qc_rework()` function
    - When qc_result = "Rework", revert item_status to "In Production"
    - Allow reprocessing of the item
    - Track rework count for metrics
    - _Requirements: 14.4_

  - [ ]* 9.5 Write property test for QC rework state reversion
    - **Property 12: QC Rework State Reversion**
    - **Validates: Requirements 14.4**
    - Create Production Order Item in "QC Pending" status
    - Record QC result = "Rework"
    - Verify item_status reverts to "In Production"
    - Verify item available for reprocessing

- [ ] 10. Implement inventory updates
  - [ ] 10.1 Create inventory update function
    - Create `update_inventory_from_production()` function in `production_order.py`
    - Trigger when Production Order Item status = "Completed" and QC passes
    - Calculate available_qty = produced_qty - wastage_qty
    - Create Stock Entry with type "Material Receipt"
    - Link Stock Entry to Production Order
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 10.2 Write property test for inventory increase accuracy
    - **Property 8: Inventory Increase Accuracy**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
    - Generate Production Order Items with various produced_qty and wastage_qty
    - Set QC result = "Passed"
    - Verify Stock Entry increases inventory by (produced_qty - wastage_qty)
    - Verify inventory does NOT increase for wastage or rejected quantities

  - [ ] 10.3 Update Item master with production metrics
    - Update Item master fields: produced_quantity, wastage_quantity, qc_reject_quantity
    - Increment produced_quantity by available_qty
    - Increment wastage_quantity by wastage_qty
    - Increment qc_reject_quantity by rejected_qty (from QC failures)
    - _Requirements: 10.5_

- [ ] 11. Checkpoint - Ensure QC and inventory updates work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement Production Manager Dashboard
  - [ ] 12.1 Create dashboard page structure
    - Create `production_manager_dashboard.js` page
    - Set up HTML structure with sections for metrics, charts, and tables
    - Add CSS styling for dashboard layout
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 12.2 Implement dashboard data aggregation functions
    - Create Python functions to aggregate Production Order data by status
    - Create `get_production_orders_by_status()` function
    - Create `get_items_in_production()` function
    - Create `get_production_units_workload()` function
    - Create `get_items_at_risk()` function (delivery_date - today ≤ 3 days)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ] 12.3 Implement dashboard charts
    - Add chart for Completion % by Production Unit (bar chart)
    - Add chart for Items by Priority Level (pie chart)
    - Add Production Timeline vs Plan (Gantt chart or timeline)
    - Use Frappe Chart library for visualization
    - _Requirements: 9.5_

  - [ ] 12.4 Implement real-time data refresh
    - Set up polling or WebSocket for real-time updates
    - Refresh dashboard data every 30 seconds
    - Update charts and metrics without full page reload
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 12.5 Implement item-level tracking view
    - Create detailed view accessible by clicking Production Order
    - Display Current Production Unit Assignment
    - Display Assigned Worker, Machine, Progress %, Estimated Completion Time
    - Show historical unit assignments (completed)
    - _Requirements: 9.6, 9.7_

- [ ] 13. Implement workflow and notifications
  - [ ] 13.1 Set up Production Order workflow
    - Create workflow definition for Production Order approval
    - Add Manufacturing Manager approval step
    - Configure workflow states matching production_status values
    - _Requirements: 15.1_

  - [ ] 13.2 Implement status change notifications
    - Add notification triggers on state transitions
    - Notify Manufacturing Manager on Draft → Planned
    - Notify Production Units on work assignment
    - Notify QC Inspector when items reach QC Pending
    - _Requirements: 13.2_

  - [ ] 13.3 Implement Sales Order rejection handling
    - Add hook to detect Sales Order rejection
    - Prevent Production Order creation if Sales Order rejected
    - Do not modify existing Production Orders on rejection
    - _Requirements: 15.3_

  - [ ]* 13.4 Write property test for Sales Order rejection
    - **Property 18: Sales Order Rejection Prevents Production Order**
    - **Validates: Requirements 15.3**
    - Create Sales Orders and reject them
    - Verify no Production Order created
    - Verify existing Production Orders unmodified

- [ ] 14. Add error handling and validation
  - [ ] 14.1 Implement comprehensive error handling
    - Add try-catch blocks for all API calls
    - Return HTTP 400 Bad Request for validation errors
    - Return HTTP 409 Conflict for data integrity errors
    - Add clear error messages for state transition failures
    - _Requirements: All validation requirements_

  - [ ] 14.2 Implement recovery mechanisms
    - Add retry logic for incomplete Material Requests (every 5 minutes)
    - Log Material Request creation failures for manual review
    - Notify Manufacturing Manager after 3 Material Request failures
    - Implement optimistic locking with version numbers for concurrent modifications
    - _Requirements: Error handling section_

  - [ ] 14.3 Add data integrity checks
    - Validate all foreign key references before storing
    - Reject non-numeric quantities with clear error
    - Enforce enum values for status fields
    - Sanitize text fields for special characters
    - _Requirements: Data validation section_

- [ ] 15. Performance optimization and indexing
  - [ ] 15.1 Add database indexes
    - Add composite index on (sales_order, production_status) in Production Order
    - Add composite index on (customer, delivery_date) in Production Order
    - Add single index on production_status for dashboard queries
    - Add single index on production_order in Production Order Item
    - Add single index on item_status in Production Order Item
    - Add composite index on (production_order_item, unit_status) in Production Unit Assignment
    - Add single index on worker_code for availability tracking
    - Add single index on machine_asset_id for equipment utilization
    - Add single index on production_order_item in QC Recording
    - _Requirements: Performance section_

  - [ ] 15.2 Implement caching strategy
    - Cache Production Unit list with 24-hour TTL
    - Cache Worker availability with 1-hour TTL
    - Cache BOM data on-access with invalidation on BOM change
    - Cache dashboard aggregates with 5-minute TTL
    - _Requirements: Performance section_

  - [ ]* 15.3 Write integration tests for performance
    - Test Production Order creation time < 500ms
    - Test Material Request generation < 2s for 100-item Production Order
    - Test dashboard load time < 3s
    - Test state transition time < 1s with validations

- [ ] 16. Add audit trail and logging
  - [ ] 16.1 Implement audit trail tracking
    - Track all status transitions with timestamp and user
    - Preserve original Production Specification versions
    - Log all validation failures for debugging
    - Record all material and QC corrections
    - _Requirements: Audit trail section_

  - [ ] 16.2 Add comprehensive logging
    - Log Production Order creation events
    - Log Material Request generation
    - Log state transition attempts (success and failure)
    - Log QC recording events
    - Log inventory updates
    - _Requirements: Audit trail section_

- [ ] 17. Final integration and testing
  - [ ]* 17.1 Write end-to-end integration tests
    - Test complete flow: Sales Order approval → Production Order → Material Request → Production → QC → Inventory
    - Test multiple Production Order Items in single order
    - Test concurrent Production Unit processing
    - Test rework cycles (Rework → In Production → Completed)
    - Test amendment with production already started

  - [ ]* 17.2 Write unit tests for edge cases
    - Test Production Orders with zero items
    - Test BOMs with missing components
    - Test concurrent item processing in same Production Order
    - Test Sales Order with all Outdoor/Purchase items (no Production Order created)

  - [ ] 17.3 Create test data and fixtures
    - Create sample Sales Orders with various item types
    - Create sample BOMs for common items
    - Create sample Production Specifications (Printing and Paper Cup)
    - Create sample Worker and Machine/Asset records

- [ ] 18. Documentation and deployment
  - [ ] 18.1 Write user documentation
    - Document how to create Production Orders from Sales Orders
    - Document how to assign Production Units
    - Document how to record QC results
    - Document dashboard usage
    - _Requirements: Implementation considerations_

  - [ ] 18.2 Write developer documentation
    - Document DocType structures and relationships
    - Document state machine transitions and validations
    - Document API functions and parameters
    - Document property-based test expectations
    - _Requirements: Implementation considerations_

  - [ ] 18.3 Prepare deployment checklist
    - Verify Manufacturing Manager role exists
    - Verify Production Units are defined in system
    - Configure acceptable wastage thresholds
    - Configure warehouse locations for material issuance
    - Run database migrations for indexes
    - _Requirements: Dependencies and prerequisites_

- [ ] 19. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All code will be written in Python using the Frappe framework
- Each task references specific requirements for traceability
- Property-based tests should run with minimum 100 iterations per property using hypothesis library
- Unit tests and integration tests should use Python's unittest or pytest framework
- Checkpoints ensure incremental validation throughout implementation
- The implementation follows Frappe DocType conventions and best practices
- Dashboard uses Frappe Chart library for visualization
- State machine validations are critical for data integrity
- Performance optimization should be done after core functionality is working

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.5", "4.1", "4.3", "4.5"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.2", "4.4", "4.6"] },
    { "id": 3, "tasks": ["5.1", "5.2", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6"] },
    { "id": 4, "tasks": ["5.3", "5.4", "6.7", "6.8", "6.9"] },
    { "id": 5, "tasks": ["8.1", "8.3", "8.4", "9.1", "9.4"] },
    { "id": 6, "tasks": ["8.2", "8.5", "8.6", "9.2", "9.3", "9.5"] },
    { "id": 7, "tasks": ["10.1", "10.3"] },
    { "id": 8, "tasks": ["10.2"] },
    { "id": 9, "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5"] },
    { "id": 10, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 11, "tasks": ["13.4", "14.1", "14.2", "14.3"] },
    { "id": 12, "tasks": ["15.1", "15.2"] },
    { "id": 13, "tasks": ["15.3", "16.1", "16.2"] },
    { "id": 14, "tasks": ["17.1", "17.2", "17.3"] },
    { "id": 15, "tasks": ["18.1", "18.2", "18.3"] }
  ]
}
```
