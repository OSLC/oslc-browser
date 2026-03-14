# OSLC Diagram Support — Design Specification

## Overview

Add support for viewing OSLC resources as diagrams in oslc4js. Diagrams are OSLC Architecture Management (AM) resources defined using the OMG Diagram Definition (DD) metamodel, expressed as an RDF vocabulary with OSLC ResourceShapes. The oslc-browser renders diagrams as SVG in a dedicated details panel tab.

## Goals

- Define a reusable RDF vocabulary and ResourceShapes for the OMG DD metamodel
- Enable any oslc-server-based application to expose diagram resources through standard OSLC services
- Provide MRM-specific diagram types: hierarchy diagrams, PLM, and SIAM
- Render diagrams in oslc-browser with interactive navigation to model elements

## Non-Goals (Current Scope)

- Interactive diagram editing (create/move/delete shapes)
- Focus-and-expand exploration (select element, double-click to extend)
- Auto-layout algorithms (diagrams have explicit DD coordinates)
- Pinning, show/hide of diagram elements

These are planned for future iterations.

## Architecture

### Core Principle: View/Model Separation

Diagrams are **views** of model elements, not replacements for them.

- **Diagram (dd:Diagram)** — An OSLC AM resource. Participates in OSLC links to requirements, test cases, change requests, etc.
- **Shapes/Edges (blank nodes)** — Visual elements within a diagram. Each references its model element via `dd:modelElement`. These are NOT OSLC resources and do not carry OSLC links.
- **Model Elements (e.g., mrm:Program)** — Carry all semantic relationships. OSLC links connect model elements to each other and to cross-domain resources.

This ensures semantic relationships are never coupled through view elements. Deleting or rearranging a diagram has no effect on model-level links.

### DD Classes Extend oslc_am:Resource

`dd:Diagram` and `dd:DiagramElement` (and subclasses Shape, Edge) inherit from `oslc_am:Resource`. This means:

- Existing OSLC AM-aware servers and clients recognize them
- They inherit standard AM properties (dcterms:title, dcterms:identifier, dcterms:creator, dcterms:created, dcterms:modified, etc.)
- They participate in OSLC linking relationships naturally
- Existing query capabilities over `oslc_am:Resource` include diagrams
- Selection dialogs for AM resources surface diagrams as link targets

### Blank Node Structure for Efficiency

Diagram elements (Shapes, Edges, Bounds, Points, Styles) are modeled as blank nodes within the Diagram resource graph. This means:

- A single fetch of the Diagram resource loads the entire structure
- Only `dd:modelElement` references are named URIs pointing to external resources
- Follows the existing pattern used for Publisher, Property definitions in ResourceShapes

---

## Phase 1: DD RDF Vocabulary and ResourceShapes

### Files

- `oslc-server/config/vocab/DD.ttl` — DD ontology/vocabulary
- `oslc-server/config/vocab/DD-Shapes.ttl` — OSLC ResourceShapes for DD classes

### Namespace

```
@prefix dd: <http://www.omg.org/spec/DD#> .
```

### DD Vocabulary Classes

**Core Classes:**

| Class | Superclass | Description |
|-------|-----------|-------------|
| `dd:Diagram` | `oslc_am:Resource` | Top-level diagram container |
| `dd:DiagramElement` | `oslc_am:Resource` | Abstract base for visual elements |
| `dd:Shape` | `dd:DiagramElement` | Element with bounds (position and size) |
| `dd:Edge` | `dd:DiagramElement` | Connection between two elements |

**Geometry Classes:**

| Class | Description |
|-------|-------------|
| `dd:Bounds` | Rectangle: x, y, width, height |
| `dd:Point` | Coordinate: x, y |
| `dd:Dimension` | Size: width, height |

**Style Classes:**

| Class | Description |
|-------|-------------|
| `dd:Style` | Abstract base for styling |
| `dd:SharedStyle` | Reusable named style |

### DD Properties

**Diagram properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:name` | `dd:Diagram` | `xsd:string` | Diagram name |
| `dd:documentation` | `dd:Diagram` | `xsd:string` | Diagram description |
| `dd:resolution` | `dd:Diagram` | `xsd:double` | Rendering resolution |
| `dd:ownedElement` | `dd:Diagram` | `dd:DiagramElement` | Elements in this diagram |

**DiagramElement properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:modelElement` | `dd:DiagramElement` | `oslc_am:Resource` | The model element this element represents |
| `dd:owningElement` | `dd:DiagramElement` | `dd:DiagramElement` | Parent element |
| `dd:ownedElement` | `dd:DiagramElement` | `dd:DiagramElement` | Child elements |
| `dd:localStyle` | `dd:DiagramElement` | `dd:Style` | Style applied to this element |
| `dd:sharedStyle` | `dd:DiagramElement` | `dd:SharedStyle` | Reference to a shared style |

**Shape properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:bounds` | `dd:Shape` | `dd:Bounds` | Position and size |

**Edge properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:source` | `dd:Edge` | `dd:DiagramElement` | Source element |
| `dd:target` | `dd:Edge` | `dd:DiagramElement` | Target element |
| `dd:waypoint` | `dd:Edge` | `dd:Point` | Ordered intermediate points |

**Bounds properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:x` | `dd:Bounds` | `xsd:double` | X coordinate |
| `dd:y` | `dd:Bounds` | `xsd:double` | Y coordinate |
| `dd:width` | `dd:Bounds` | `xsd:double` | Width |
| `dd:height` | `dd:Bounds` | `xsd:double` | Height |

**Point properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:x` | `dd:Point` | `xsd:double` | X coordinate |
| `dd:y` | `dd:Point` | `xsd:double` | Y coordinate |

**Style properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:fill` | `dd:Style` | `xsd:boolean` | Whether to fill |
| `dd:fillColor` | `dd:Style` | `xsd:string` | Fill color (CSS color) |
| `dd:fillOpacity` | `dd:Style` | `xsd:double` | Fill opacity (0-1) |
| `dd:stroke` | `dd:Style` | `xsd:boolean` | Whether to stroke |
| `dd:strokeColor` | `dd:Style` | `xsd:string` | Stroke color |
| `dd:strokeWidth` | `dd:Style` | `xsd:double` | Stroke width |
| `dd:strokeOpacity` | `dd:Style` | `xsd:double` | Stroke opacity (0-1) |
| `dd:strokeDashLength` | `dd:Style` | `xsd:double` | Dash length |
| `dd:strokeDashGap` | `dd:Style` | `xsd:double` | Dash gap |
| `dd:fontSize` | `dd:Style` | `xsd:double` | Font size |
| `dd:fontName` | `dd:Style` | `xsd:string` | Font family |
| `dd:fontColor` | `dd:Style` | `xsd:string` | Font color |
| `dd:fontBold` | `dd:Style` | `xsd:boolean` | Bold |
| `dd:fontItalic` | `dd:Style` | `xsd:boolean` | Italic |
| `dd:fontUnderline` | `dd:Style` | `xsd:boolean` | Underline |
| `dd:fontStrikeThrough` | `dd:Style` | `xsd:boolean` | Strikethrough |
| `dd:shapeType` | `dd:Style` | `xsd:string` | Shape rendering hint: "rect", "ellipse", "roundedRect", "diamond", "stickFigure" |

### ResourceShapes

`DD-Shapes.ttl` uses the MRM reusable property pattern:

```turtle
# Reusable property definitions
<#p-name>
  a oslc:Property ;
  oslc:name "name" ;
  oslc:propertyDefinition dd:name ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

<#p-ownedElement>
  a oslc:Property ;
  oslc:name "ownedElement" ;
  oslc:propertyDefinition dd:ownedElement ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .  # blank nodes are inline

# ... more reusable properties ...

# Shape definitions
<#DiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Diagram" ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-identifier>, <#p-name>,
    <#p-documentation>, <#p-resolution>, <#p-ownedElement> .

<#ShapeShape>
  a oslc:ResourceShape ;
  dcterms:title "Shape" ;
  oslc:describes dd:Shape ;
  oslc:property <#p-modelElement>, <#p-localStyle>,
    <#p-sharedStyle>, <#p-bounds>, <#p-ownedElement> .

<#EdgeShape>
  a oslc:ResourceShape ;
  dcterms:title "Edge" ;
  oslc:describes dd:Edge ;
  oslc:property <#p-modelElement>, <#p-localStyle>,
    <#p-source>, <#p-target>, <#p-waypoint> .

<#BoundsShape>
  a oslc:ResourceShape ;
  dcterms:title "Bounds" ;
  oslc:describes dd:Bounds ;
  oslc:property <#p-x>, <#p-y>, <#p-width>, <#p-height> .

<#PointShape>
  a oslc:ResourceShape ;
  dcterms:title "Point" ;
  oslc:describes dd:Point ;
  oslc:property <#p-x>, <#p-y> .

<#StyleShape>
  a oslc:ResourceShape ;
  dcterms:title "Style" ;
  oslc:describes dd:Style ;
  oslc:property <#p-fill>, <#p-fillColor>, <#p-fillOpacity>,
    <#p-stroke>, <#p-strokeColor>, <#p-strokeWidth>,
    <#p-strokeOpacity>, <#p-strokeDashLength>, <#p-strokeDashGap>,
    <#p-fontSize>, <#p-fontName>, <#p-fontColor>,
    <#p-fontBold>, <#p-fontItalic>, <#p-fontUnderline>,
    <#p-fontStrikeThrough>, <#p-shapeType> .

<#SharedStyleShape>
  a oslc:ResourceShape ;
  dcterms:title "SharedStyle" ;
  oslc:describes dd:SharedStyle ;
  oslc:property <#p-title>, <#p-fill>, <#p-fillColor>, ... .
```

---

## Phase 2: MRM Diagram Type Definitions

### Files

- `mrm-server/config/vocab/MRMS-DiagramStyles.ttl` — Shared styles for MRM resource types
- `mrm-server/config/vocab/MRMS-DiagramShapes.ttl` — ResourceShapes for MRM diagram types

### Shared Styles

Each MRM resource type gets a SharedStyle defining its visual appearance:

| Style | shapeType | fillColor | Notes |
|-------|-----------|-----------|-------|
| `mrm:OrgUnitStyle` | rect | #cce5ff (light blue) | Matches SIAM image |
| `mrm:ProgramStyle` | rect | #d4edda (light green) | Distinct from OrgUnit |
| `mrm:ServiceStyle` | roundedRect | #c3e6cb (green) | Rounded, as in SIAM image |
| `mrm:ProcessStyle` | ellipse | #e2e3e5 (light gray) | Ellipses in SIAM image |
| `mrm:ResourceStyle` | rect | #fff3cd (light yellow) | Dashed stroke |
| `mrm:OutcomeStyle` | ellipse | #d1ecf1 (light cyan) | Distinct from Process |
| `mrm:OutputStyle` | rect | #f8f9fa (near white) | Text-oriented, thin border |
| `mrm:NeedStyle` | ellipse | #f5c6cb (light pink) | Distinct |
| `mrm:TargetGroupStyle` | stickFigure | none | Stick figure as in SIAM image |
| `mrm:HierarchyEdgeStyle` | — | — | Solid line, arrow end |
| `mrm:ContributoryEdgeStyle` | — | — | Solid line, arrow end |

### Diagram ResourceShapes

**Hierarchy Diagrams** (one per hierarchical MRM type):

- `OrgUnitDiagramShape` — Constrains `dd:ownedElement` to shapes with `dd:modelElement` of type `mrm:OrganizationUnit` and edges with `dd:sharedStyle` of `mrm:HierarchyEdgeStyle`
- `ProgramDiagramShape`, `ServiceDiagramShape`, `ProcessDiagramShape`, `ResourceDiagramShape`, `NeedDiagramShape`, `OutcomeDiagramShape`, `OutputDiagramShape`, `TargetGroupDiagramShape` — Same pattern, different MRM types and styles

**PLM Diagram:**

- `PLMDiagramShape` — Elements include shapes for Program, Service, Output, and Outcome. Edges represent contributory relationships (Program→Service, Service→Output, Output→Outcome). Uses `mrm:ContributoryEdgeStyle`.

**SIAM Diagram:**

- `SIAMDiagramShape` — Elements include shapes for OrgUnit/Program (top), Service, Process, Output, and TargetGroup. Edges represent accountability chains. Multiple shape styles coexist. Layout is generally top-down with the OrgUnit/Program at the top and TargetGroups at the bottom.

---

## Phase 3: MRM Catalog Template Extensions

### Changes to `mrm-server/config/catalog-template.ttl`

**Domain addition:**

```turtle
<urn:oslc:template/sp/service>
  a oslc:Service ;
  oslc:domain oslc_am:, mrm:, dd: ;  # dd: added
```

**New Creation Factories** (added to existing service):

One creation factory per diagram type. Example:

```turtle
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Organization Unit Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OrgUnitDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create PLM Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#PLMDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create SIAM Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#SIAMDiagramShape>
  ] ;
```

Plus creation factories for each hierarchy diagram type (Program, Service, Process, Resource, Need, Outcome, Output, TargetGroup).

**New Creation Dialogs:**

```turtle
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Organization Unit Diagram" ;
    oslc:label "New OrgUnit Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OrgUnitDiagramShape>
  ] ;
```

Same pattern for each diagram type.

**New Selection Dialogs:**

```turtle
  oslc:selectionDialog [
    a oslc:Dialog ;
    dcterms:title "Select Diagram" ;
    oslc:label "Select Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:usage oslc:default
  ] ;
```

**New Query Capabilities:**

```turtle
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Organization Unit Diagrams" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OrgUnitDiagramShape>
  ] ;
```

Same pattern for PLM, SIAM, and each hierarchy diagram type.

---

## Phase 4: oslc-browser Diagram Rendering

### Integration Point

Diagrams are navigated in the column view like any other OSLC resource. Their properties appear in the Properties tab as usual. When the selected resource has `rdf:type dd:Diagram`, a **new "Diagram" tab** appears in the bottom details panel alongside Properties and Explorer.

### Data Flow

1. **Detection:** When a resource is loaded, check if `rdf:type` includes `dd:Diagram`
2. **Already loaded:** Diagram elements are blank nodes within the diagram resource graph — already fetched with the diagram itself
3. **Resolve model element titles:** For each shape's `dd:modelElement` URI, request the OSLC Compact representation (same mechanism used for title resolution in the column view). This minimizes network traffic.
4. **Render SVG:** Map DD properties to SVG elements

### New React Components

**`DiagramTab.tsx`**
- Added to `DetailsPanel.tsx` tab list
- Conditionally visible when the current resource is a `dd:Diagram`
- Contains the `DiagramCanvas` and `DiagramToolbar`

**`DiagramCanvas.tsx`**
- SVG viewport with pan (drag) and zoom (scroll wheel)
- Iterates over `dd:ownedElement` blank nodes
- Renders `DiagramShape` for each `dd:Shape`
- Renders `DiagramEdge` for each `dd:Edge`
- Manages viewBox for fit-to-content

**`DiagramShape.tsx`**
- Reads `dd:bounds` (x, y, width, height) and `dd:localStyle`/`dd:sharedStyle`
- Renders SVG element based on `dd:shapeType`:
  - `"rect"` → `<rect>`
  - `"ellipse"` → `<ellipse>`
  - `"roundedRect"` → `<rect rx="..." ry="...">`
  - `"diamond"` → `<polygon>`
  - `"stickFigure"` → SVG `<g>` with head circle, body/arm/leg lines
- Applies style: `fillColor`→`fill`, `strokeColor`→`stroke`, `strokeWidth`→`stroke-width`, etc.
- Renders model element title as `<text>` centered in bounds
- Click handler: navigates to `dd:modelElement` URI in column view
- Hover handler: shows tooltip with compact representation

**`DiagramEdge.tsx`**
- Reads `dd:source`, `dd:target` (blank node references to shapes), `dd:waypoint` points
- Computes path from source shape bounds → waypoints → target shape bounds
- Renders `<path>` or `<polyline>` with arrow marker at target end
- Applies edge style properties

**`DiagramToolbar.tsx`**
- Zoom in/out buttons
- Fit-to-view button
- Layout direction indicator (informational — diagrams have explicit coordinates)

### SVG Property Mapping

| DD Property | SVG Attribute |
|-------------|--------------|
| `dd:fillColor` | `fill` |
| `dd:fillOpacity` | `fill-opacity` |
| `dd:strokeColor` | `stroke` |
| `dd:strokeWidth` | `stroke-width` |
| `dd:strokeOpacity` | `stroke-opacity` |
| `dd:strokeDashLength` + `dd:strokeDashGap` | `stroke-dasharray` |
| `dd:fontSize` | `font-size` |
| `dd:fontName` | `font-family` |
| `dd:fontColor` | `fill` (on `<text>`) |
| `dd:fontBold` | `font-weight: bold` |
| `dd:fontItalic` | `font-style: italic` |
| `dd:fontUnderline` | `text-decoration: underline` |
| `dd:fontStrikeThrough` | `text-decoration: line-through` |
| `dd:x`, `dd:y` | `x`, `y` / `cx`, `cy` |
| `dd:width`, `dd:height` | `width`, `height` / `rx`, `ry` |

---

## Future Direction

The following capabilities are planned for future iterations but are **out of scope** for the current design:

- **Focus-and-expand exploration:** Select a model element as focus, create a diagram showing just that element, double-click to extend and show related resources and links
- **Pinning:** User pins diagram elements at specific locations during interactive exploration
- **Auto-layout:** Automatic layout algorithms (tree, force-directed) for hierarchy and network diagrams, with top-down and left-right options
- **Show/hide elements:** Toggle visibility of diagram elements during exploration
- **Diagram editing:** Create, move, resize, delete shapes and edges interactively
- **Approach B elements:** Embed key model element properties in diagram elements to reduce round-trips
- **Approach C elements:** Generate diagrams on-the-fly from model relationship queries

---

## File Summary

| Phase | File | Location | Description |
|-------|------|----------|-------------|
| 1 | `DD.ttl` | `oslc-server/config/vocab/` | DD ontology vocabulary |
| 1 | `DD-Shapes.ttl` | `oslc-server/config/vocab/` | DD ResourceShapes |
| 2 | `MRMS-DiagramStyles.ttl` | `mrm-server/config/vocab/` | Shared styles for MRM types |
| 2 | `MRMS-DiagramShapes.ttl` | `mrm-server/config/vocab/` | Diagram type ResourceShapes |
| 3 | `catalog-template.ttl` | `mrm-server/config/` | Extended with diagram services |
| 4 | `DiagramTab.tsx` | `oslc-browser/src/components/` | Diagram tab in details panel |
| 4 | `DiagramCanvas.tsx` | `oslc-browser/src/components/` | SVG viewport with pan/zoom |
| 4 | `DiagramShape.tsx` | `oslc-browser/src/components/` | Shape SVG rendering |
| 4 | `DiagramEdge.tsx` | `oslc-browser/src/components/` | Edge SVG rendering |
| 4 | `DiagramToolbar.tsx` | `oslc-browser/src/components/` | Zoom/fit controls |
