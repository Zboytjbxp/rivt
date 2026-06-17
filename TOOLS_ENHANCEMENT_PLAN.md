# Tools Section Enhancement Plan

## Current State

The Tools section has solid foundations but needs deepening in two critical areas:

### Existing Components ✓
- **Invoice Builder** - Form + preview, email/SMS/download/copy
- **Estimate Calculator** - Difficulty multipliers, breakdown view, range recommendation
- **Small Tools Grid**
  - Fraction/foot-inch multiplier (basic)
  - Material waste calculator
  - Payment note generator

### Current Issues
1. **Invoice Tool**: Lacks professional templates, line items, tax calculation guidance, PDF export
2. **Fractions Tool**: Very basic — no fraction input (only decimals), no common trade shortcuts (studs, joists, etc.)
3. **Estimate Calculator**: Limited explanations, no saved estimates, no comparison tools
4. **Overall UX**: Tools feel scattered; no persistent state; no export/save features

---

## Phase 1: Invoice/Estimate Tool Enhancement

### What We're Building
A **professional invoice & estimate generator** that handles:
1. Multiple line items (labor, materials, services)
2. Tax handling (various state rates)
3. Discounts and deposits
4. Professional PDF export
5. Invoice templates (standard, detailed, summary)
6. Quick-preset builders (hourly, fixed-price, T&M)

### Key Features

#### 1.1 Line Items System
```typescript
interface InvoiceLineItem {
  id: string;
  type: "labor" | "material" | "service" | "discount" | "deposit";
  description: string;
  quantity: number;
  unit: string; // "hrs", "ea", "sq ft", etc.
  unitPrice: number;
  tax: boolean;
}
```

- Add/remove items dynamically
- Drag to reorder
- Subtotals by type (labor, materials, etc.)
- Automatic tax on selected items

#### 1.2 Invoice Templates
```
- "Hourly": Labor + materials + tax
- "Fixed Price": Simple total + terms
- "T&M": Time & materials detailed breakdown
- "Estimate": Project-based with contingency
- "Quote": Formal estimate with expiry date
```

#### 1.3 Smart Tax Handling
- Detect state from job location
- Use actual state sales tax rates (JSON lookup table)
- Checkbox per item to include in taxable subtotal
- Show tax breakdown clearly

#### 1.4 PDF Export
- Use `html2pdf` or `jsPDF + html2canvas`
- Professional layout with RIVT branding
- QR code linking back to job (if possible)
- Signature block for formal quotes

#### 1.5 Quick-Fill Presets
- "Hourly work": Fill hours + rate, auto-calculate
- "Material pickup": Material cost + markup %
- "Time & materials": Pre-fill standard markup
- Template buttons pre-populate based on selected job

### UI Structure

```
Invoice Builder (full-width, two-panel)
├─ Left Panel: Editor
│  ├─ Invoice header (number, date, due date)
│  ├─ Party info (bill to, pay to, email, phone)
│  ├─ Line items table
│  │  ├─ Add item button
│  │  ├─ Item rows (description, qty, unit, price, remove)
│  │  └─ Subtotals row
│  ├─ Discount & deposits section
│  ├─ Tax settings
│  └─ Terms & notes textarea
└─ Right Panel: Preview & Actions
   ├─ Live invoice preview
   ├─ Total due (large, prominent)
   ├─ Action buttons:
   │  ├─ Email
   │  ├─ Text
   │  ├─ PDF Download
   │  ├─ Print
   │  ├─ Copy text
   │  └─ Save as draft
   ├─ Status badge (Draft/Sent/Paid)
   └─ Quick templates carousel
```

---

## Phase 2: Fractions & Construction Calculator Enhancement

### What We're Building
A **comprehensive construction calculator** that handles:
1. Fraction input (1 3/4", 2-3/8", etc.)
2. Common construction shortcuts (lumber spacing, stud layouts, etc.)
3. Material quantity estimation
4. Unit conversions (metric ↔ imperial)
5. Real-world trade shortcuts

### Key Features

#### 2.1 Enhanced Fraction Input
```typescript
// Current: decimal (12.5")
// New: support both
interface MeasurementInput {
  feet: number;
  inches: number;
  eighths: number; // 0-8 (represents 1/8" increments)
  // Renders as: 12' 7 3/8"
  // Converts to: 151.375 inches
}
```

- Input accepts:
  - `12.5` (decimal)
  - `12 3/4` (mixed)
  - `12' 7 3/8"` (formal)
- Visual input with sliders for 1/8" increments
- Copy/paste friendly output
- "Snap to 1/8" or "Snap to 1/4" options

#### 2.2 Trade-Specific Shortcuts

**Framing shortcuts:**
- Stud spacing: `16" OC` or `24" OC` → how many studs for a wall?
- Joist/rafter spacing calculator
- Plate layout (rim, top, bottom)
- Board feet calculator (lumber estimator)

**Drywall/finishing:**
- Sheet layout (4×8 or 4×12) for a wall
- Stud pack needed for a job
- Linear feet to sheets converter

**Flooring:**
- Square footage with waste %
- Box count for tile/planks
- Grout/underlayment calculator

**Plumbing/electrical:**
- Pipe run length for materials
- Conduit bends and routing
- Fixture spacing (rough-in dimensions)

#### 2.3 Material Estimators

```typescript
interface MaterialEstimate {
  name: string; // "2x4 Studs"
  quantity: number;
  unit: string; // "pcs", "bd ft", "linear ft"
  wastePercent: number;
  estimated Cost: number; // If cost/unit entered
}
```

- Lumber calculator (board feet)
- Tile/flooring (sq ft + grout)
- Paint (sq ft + coats)
- Concrete (cubic yards)
- Roofing (squares)

#### 2.4 Unit Conversions
- Metric ↔ Imperial toggle
- Common conversions:
  - `1 sq yard = 9 sq feet`
  - `1 sq meter = 10.76 sq feet`
  - `1 board foot = 144 cubic inches`
  - `1 cubic yard = 27 cubic feet`

### UI Structure

```
Construction Calculator (tabbed interface)
├─ Tab 1: Measurements
│  ├─ Input A: feet / inches / eighths selector
│  ├─ Input B: feet / inches / eighths selector
│  ├─ Operation buttons: +, -, ×, ÷
│  ├─ Quick templates:
│  │  ├─ "Divide into N pieces"
│  │  ├─ "Multiply by crew size"
│  │  ├─ "Add waste %"
│  │  └─ "Snap to 16\" OC"
│  └─ Output (large, all formats: decimal / mixed / imperial)
│
├─ Tab 2: Shortcuts
│  ├─ Stud layout (wall length → stud count)
│  ├─ Joist/rafter calc (span → spacing → count)
│  ├─ Sheet layout (wall dims → 4×8/4×12 sheets)
│  ├─ Board feet (length × width × thickness)
│  └─ Common spacing presets (16" OC, 24" OC, etc.)
│
├─ Tab 3: Material Estimator
│  ├─ Material type dropdown
│  ├─ Quantity input (sq ft, linear ft, board ft, etc.)
│  ├─ Waste % slider
│  ├─ Cost/unit (optional)
│  ├─ Line items list:
│  │  ├─ Add item button
│  │  ├─ Item rows
│  │  └─ Total estimate
│  └─ Export to estimate
│
└─ Tab 4: Quick Refs (read-only)
   ├─ Lumber spacing (16", 24" OC stud counts)
   ├─ Material weights (per sq ft)
   ├─ Code minimums (header sizes, joist depth, etc.)
   └─ Conversion tables
```

---

## Phase 3: Cross-Tool Features

### 3.1 Persistent State
- Save calculators/invoices to localStorage
- "Recent calculations" carousel
- "Saved estimates" folder
- Sync across sessions

### 3.2 Export & Share
- PDF for invoices
- Image (PNG) for calculator results
- Share links (encoded calculation)
- Email summary

### 3.3 Integration with Job
- Pre-fill from selected job (materials budget, labor hours)
- "Add to job record" → attach invoice/estimate to job
- One-click "Create invoice from this estimate"
- Invoice history per job

### 3.4 Mobile Optimization
- Fraction input: numeric keypad-friendly
- Calculator: large buttons, tap-friendly
- Preview on right side becomes bottom drawer on mobile

---

## Implementation Checklist

### Invoice Tool
- [ ] Refactor to line-items system
- [ ] Add tax state lookup (50-state table)
- [ ] PDF export (jsPDF or html2pdf)
- [ ] Multiple templates UI
- [ ] Quick-preset builders
- [ ] Save draft to localStorage
- [ ] Invoice history per job
- [ ] Discount + deposit fields
- [ ] Notes textarea
- [ ] Professional CSS styling

### Fractions Calculator
- [ ] Measurement input component (feet/inches/eighths)
- [ ] Mixed number display (12' 7 3/8")
- [ ] Trade-specific shortcut buttons (stud layout, joists, etc.)
- [ ] Stud spacing calculator
- [ ] Joist/rafter calculator
- [ ] Sheet layout calculator
- [ ] Board feet calculator
- [ ] Material estimator with line items
- [ ] Waste % handling
- [ ] Unit conversion (metric/imperial)
- [ ] Copy to clipboard (all formats)
- [ ] Tab UI for organization
- [ ] Mobile-optimized input

### Cross-Tool
- [ ] Unified "recent calculations" view
- [ ] "Create invoice from estimate" button
- [ ] Attach invoice/calc to job record
- [ ] localStorage persistence
- [ ] Export as image/PDF
- [ ] Responsive layout (mobile drawers)

---

## Styling Approach

New CSS classes:
```css
.invoice-line-items { /* table with add/remove */ }
.measurement-input { /* feet/inches/eighths input */ }
.trade-shortcut-buttons { /* stud layout, joist calc, etc. */ }
.calculator-tabs { /* measurement / shortcuts / materials / refs */ }
.material-estimate-list { /* line items for materials */ }
.invoice-template-carousel { /* quick presets */ }
```

Keep existing structure but extend with new modular components.

---

## Priority Order

1. **Invoice enhancement** (high-impact for immediate use)
   - Line items system
   - Tax handling
   - PDF export
2. **Measurement improvements** (fractions input + common shortcuts)
3. **Material estimator** (reusable across jobs)
4. **Persistence & integration** (cross-tool features)

---

## Tech Stack
- No external libs required (except jsPDF if using PDF)
- Stick with React hooks + TypeScript
- localStorage for persistence
- CSS for styling (no new dependencies)
