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

### Only dd:Diagram Extends oslc_am:Resource

Only `dd:Diagram` inherits from `oslc_am:Resource`. This means:

- Diagrams are recognized by OSLC AM-aware servers and clients
- Diagrams inherit standard AM properties (dcterms:title, dcterms:identifier, dcterms:creator, dcterms:created, dcterms:modified, etc.)
- Diagrams participate in OSLC linking relationships naturally
- Existing query capabilities over `oslc_am:Resource` include diagrams
- Selection dialogs for AM resources surface diagrams as link targets

`dd:DiagramElement`, `dd:Shape`, and `dd:Edge` are plain `rdfs:Class` instances — they do NOT extend `oslc_am:Resource`, since they are modeled as blank nodes within the Diagram graph and cannot be independently addressed, linked, or queried.

### Blank Node Structure for Efficiency

Diagram elements (Shapes, Edges, Bounds, Points, Styles) are modeled as blank nodes within the Diagram resource graph. This means:

- A single fetch of the Diagram resource loads the entire structure
- Only `dd:modelElement` references are named URIs pointing to external resources
- Follows the existing pattern used for Publisher, Property definitions in ResourceShapes

### Diagram Type Differentiation

All diagram types share `oslc:resourceType dd:Diagram`. Differentiation between diagram types (OrgUnit diagram vs. SIAM diagram) is through `oslc:resourceShape` on creation factories and query capabilities. This is intentional — OSLC query capabilities use `oslc.where` predicates to filter results, and the shape constrains what properties are valid for each diagram type. No MRM-specific subclasses of `dd:Diagram` are needed.

---

## Phase 1: DD RDF Vocabulary and ResourceShapes

### Files

- `oslc-server/config/vocab/DD.ttl` — DD ontology/vocabulary
- `oslc-server/config/vocab/DD-Shapes.ttl` — OSLC ResourceShapes for DD classes

**Note:** This introduces a new `vocab/` directory under `oslc-server/config/`, separate from the existing `shapes/` directory. The `shapes/` directory holds server-specific ResourceShapes (ChangeRequest, Requirement). The new `vocab/` directory holds reusable domain vocabularies and their shapes that can be shared across oslc-server-based applications. The mrm-server already follows this convention with `config/vocab/`.

### Namespace

```
@prefix dd: <http://www.omg.org/spec/DD#> .
```

### DD Vocabulary Classes

**Core Classes:**

| Class | Superclass | Description |
|-------|-----------|-------------|
| `dd:Diagram` | `oslc_am:Resource` | Top-level diagram container |
| `dd:DiagramElement` | `rdfs:Class` | Abstract base for visual elements (blank nodes) |
| `dd:Shape` | `dd:DiagramElement` | Element with bounds (position and size) |
| `dd:Edge` | `dd:DiagramElement` | Connection between two elements |

**Geometry Classes:**

| Class | Description |
|-------|-------------|
| `dd:Bounds` | Rectangle: x, y, width, height |
| `dd:Point` | Coordinate: x, y |

**Style Classes:**

| Class | Description |
|-------|-------------|
| `dd:Style` | Abstract base for styling |
| `dd:SharedStyle` | Reusable named style |

### DD Properties

**Diagram properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dcterms:title` | (inherited from `oslc_am:Resource`) | `xsd:string` | Diagram name |
| `dcterms:description` | (inherited from `oslc_am:Resource`) | `xsd:string` | Diagram description |
| `dd:resolution` | `dd:Diagram` | `xsd:double` | Rendering resolution |
| `dd:diagramElement` | `dd:Diagram` | `dd:DiagramElement` | Top-level elements in this diagram |

**Note:** `dd:name` and `dd:documentation` from the OMG DD metamodel map directly to `dcterms:title` and `dcterms:description` inherited from `oslc_am:Resource`. No separate DD properties are needed.

**DiagramElement properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:modelElement` | `dd:DiagramElement` | `rdfs:Resource` | The model element this element represents |
| `dd:owningElement` | `dd:DiagramElement` | `dd:DiagramElement` | Parent element |
| `dd:ownedElement` | `dd:DiagramElement` | `dd:DiagramElement` | Nested child elements (element-to-element containment) |
| `dd:localStyle` | `dd:DiagramElement` | `dd:Style` | Style applied to this element |
| `dd:sharedStyle` | `dd:DiagramElement` | `dd:SharedStyle` | Reference to a shared style |

**Note:** `dd:diagramElement` (Diagram→DiagramElement) and `dd:ownedElement` (DiagramElement→DiagramElement) are distinct properties to avoid RDF domain union issues. `dd:diagramElement` is used only on Diagrams for top-level elements. `dd:ownedElement` is used on DiagramElements for nesting (e.g., a shape containing sub-shapes).

**Shape properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:bounds` | `dd:Shape` | `dd:Bounds` | Position and size |

**Edge properties:**

| Property | Domain | Range | Description |
|----------|--------|-------|-------------|
| `dd:source` | `dd:Edge` | `dd:DiagramElement` | Source element (blank node reference) |
| `dd:target` | `dd:Edge` | `dd:DiagramElement` | Target element (blank node reference) |
| `dd:waypoint` | `dd:Edge` | `rdf:List` | Ordered list of `dd:Point` instances |

**Note on waypoint ordering:** `dd:waypoint` uses `rdf:List` to preserve point order. In Turtle serialization this appears as `dd:waypoint ( _:p1 _:p2 _:p3 )`. The renderer processes the list in order to construct the edge path.

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

**Note:** `dd:shapeType` is a property of `dd:Style`, not `dd:Shape`. Renderers must dereference the shape's `dd:localStyle` or `dd:sharedStyle` to determine which SVG element type to use.

### ResourceShapes

`DD-Shapes.ttl` uses the MRM reusable property pattern:

```turtle
# Reusable property definitions
<#p-diagramElement>
  a oslc:Property ;
  oslc:name "diagramElement" ;
  oslc:propertyDefinition dd:diagramElement ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .  # blank nodes are inline

<#p-ownedElement>
  a oslc:Property ;
  oslc:name "ownedElement" ;
  oslc:propertyDefinition dd:ownedElement ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

# ... more reusable properties ...

# Shape definitions
<#DiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Diagram" ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-identifier>, <#p-description>,
    <#p-resolution>, <#p-diagramElement> .

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
  oslc:property <#p-title>, <#p-fill>, <#p-fillColor>,
    <#p-fillOpacity>, <#p-stroke>, <#p-strokeColor>,
    <#p-strokeWidth>, <#p-strokeOpacity>, <#p-strokeDashLength>,
    <#p-strokeDashGap>, <#p-fontSize>, <#p-fontName>,
    <#p-fontColor>, <#p-fontBold>, <#p-fontItalic>,
    <#p-fontUnderline>, <#p-fontStrikeThrough>, <#p-shapeType> .
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

**Note on type constraints:** OSLC ResourceShapes cannot express transitive type constraints (e.g., "ownedElement shapes must have modelElement of type mrm:OrganizationUnit"). The constraints described below are **documentation-level conventions**, not shape-enforced. Creation dialogs and application logic enforce these conventions at runtime.

**Hierarchy Diagrams** (one per hierarchical MRM type):

Example Turtle for `OrgUnitDiagramShape`:

```turtle
<#OrgUnitDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Organization Unit Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing OrganizationUnit parent-child relationships. Shapes reference mrm:OrganizationUnit model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-identifier>, <#p-description>,
    <#p-resolution>, <#p-diagramElement> .
```

- `ProgramDiagramShape`, `ServiceDiagramShape`, `ProcessDiagramShape`, `ResourceDiagramShape`, `NeedDiagramShape`, `OutcomeDiagramShape`, `OutputDiagramShape`, `TargetGroupDiagramShape` — Same pattern with descriptions specifying the relevant MRM type and style conventions.

**PLM Diagram:**

```turtle
<#PLMDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Program Logic Model Diagram" ;
  dcterms:description "Shows contributory relationships: Program → Services → Outputs → Outcomes. Shapes reference mrm:Program, mrm:Service, mrm:Output, and mrm:Outcome model elements. Edges use mrm:ContributoryEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-identifier>, <#p-description>,
    <#p-resolution>, <#p-diagramElement> .
```

**SIAM Diagram:**

```turtle
<#SIAMDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Service Integrated Accountability Model Diagram" ;
  dcterms:description "Traces accountability chains from OrganizationUnit/Program through Services and Processes to Outputs and TargetGroups. Multiple shape styles coexist. Layout is generally top-down." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-identifier>, <#p-description>,
    <#p-resolution>, <#p-diagramElement> .
```

---

## Phase 3: MRM Catalog Template Extensions

### Changes to `mrm-server/config/catalog-template.ttl`

**Prefix addition:** Add `@prefix dd: <http://www.omg.org/spec/DD#> .` to the prefix declarations at the top of the file.

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

**Note:** This is the first `oslc:selectionDialog` in the MRM catalog template. Selection dialogs are not yet used for other MRM resource types but can be back-filled later. They are added here for diagrams because diagrams are natural link targets from cross-domain resources (requirements, test cases).

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

**Note:** `oslc:queryBase` is omitted from the template because it is resolved at runtime by the oslc-service template processor, consistent with the existing MRM query capabilities.

---

## Phase 4: oslc-browser Diagram Rendering

### Integration Point

Diagrams are navigated in the column view like any other OSLC resource. Their properties appear in the Properties tab as usual. When the selected resource has `rdf:type dd:Diagram`, a **new "Diagram" tab** appears in the bottom details panel alongside Properties and Explorer.

### Data Flow

1. **Detection:** When a resource is loaded, check if `LoadedResource.resourceTypes` includes the `dd:Diagram` URI (`http://www.omg.org/spec/DD#Diagram`). The `resourceTypes` array is already populated by the existing RDF parsing logic in `useOslcClient.ts`.
2. **Already loaded:** Diagram elements are blank nodes within the diagram resource graph — already fetched with the diagram itself. They appear in `LoadedResource.inlineResources`.
3. **Build element map:** On initial parse, build an in-memory `Map<string, DiagramElement>` keyed by blank node ID. This allows `dd:source` and `dd:target` on edges to be resolved to their corresponding shape objects for computing connection endpoints from bounds.
4. **Resolve model element titles:** For each shape's `dd:modelElement` URI, request the OSLC Compact representation (same mechanism used for title resolution in the column view). This minimizes network traffic.
5. **Render SVG:** Map DD properties to SVG elements.

### New React Components

**`DiagramTab.tsx`**
- Added to `DetailsPanel.tsx` tab list
- Conditionally visible when the current resource is a `dd:Diagram`
- Contains the `DiagramCanvas` and `DiagramToolbar`

**`DiagramCanvas.tsx`**
- SVG viewport with pan (drag) and zoom (scroll wheel)
- Iterates over `dd:diagramElement` blank nodes
- Renders `DiagramShape` for each `dd:Shape`
- Renders `DiagramEdge` for each `dd:Edge`
- Manages viewBox for fit-to-content

**`DiagramShape.tsx`**
- Reads `dd:bounds` (x, y, width, height) from the shape's blank node
- Dereferences `dd:localStyle` or `dd:sharedStyle` to get `dd:shapeType` and visual properties
- Renders SVG element based on `dd:shapeType`:
  - `"rect"` → `<rect>`
  - `"ellipse"` → `<ellipse>`
  - `"roundedRect"` → `<rect rx="..." ry="...">`
  - `"diamond"` → `<polygon>`
  - `"stickFigure"` → SVG `<g>` with head circle, body/arm/leg lines
- Applies style: `fillColor`→`fill`, `strokeColor`→`stroke`, `strokeWidth`→`stroke-width`, etc.
- Renders model element title (from compact representation) as `<text>` centered in bounds
- Click handler: navigates to `dd:modelElement` URI in column view
- Hover handler: shows tooltip with compact representation

**`DiagramEdge.tsx`**
- Reads `dd:source`, `dd:target` blank node references; resolves them via the element map to get their `dd:bounds` for computing connection points
- Reads `dd:waypoint` `rdf:List` and iterates the ordered `dd:Point` blank nodes
- Computes path from source shape bounds → waypoints → target shape bounds
- Renders `<path>` or `<polyline>` with arrow marker at target end
- Applies edge style properties

**`DiagramToolbar.tsx`**
- Zoom in/out buttons
- Fit-to-view button
- Layout direction indicator (informational — diagrams have explicit coordinates)

### Diagram Auto-Generation from Model Elements

The creation factories in Phase 3 create empty diagram resources. To populate diagrams with shapes and edges, the browser provides a **"Create Diagram"** context menu on any resource selected in the column view.

**Discovery — catalog introspection:**

When a resource is selected, the browser inspects the connected server's service provider catalog to find diagram creation factories whose `oslc:resourceShape` description mentions the selected resource's `rdf:type`. For example, selecting an `mrm:OrganizationUnit` would surface menu items for "Organization Unit Hierarchy Diagram" and "SIAM Diagram" (since both reference OrgUnit in their shape descriptions). The matching is done by checking whether any of the resource's `rdf:type` values appear in the diagram shape's `dcterms:description`.

**Menu items:**

The context menu (right-click or action button) on a selected resource shows a "Create Diagram" submenu listing all matching diagram types. For example, on an OrganizationUnit:
- Create Organization Unit Hierarchy Diagram
- Create SIAM Diagram

**Auto-generation — generic relationship traversal:**

When the user selects a diagram type, the browser:

1. **Creates the diagram resource** via the creation factory (POST to the factory URL), with `dcterms:title` set to e.g., "Fire Department - SIAM Diagram"
2. **Traverses outgoing links** from the selected resource, recursively to a default depth of 2:
   - For each discovered resource, create a `dd:Shape` blank node with `dd:modelElement` pointing to it
   - For each link traversed, create a `dd:Edge` blank node with `dd:source`/`dd:target` referencing the corresponding shapes
3. **Assigns shared styles** based on the discovered resource's `rdf:type` — if a `dd:SharedStyle` exists for that type (e.g., `mrm:ServiceStyle` for `mrm:Service`), it is referenced via `dd:sharedStyle`. Resources with no matching style get a default style.
4. **Applies default layout** — a simple grid or tree layout algorithm assigns `dd:bounds` coordinates to each shape:
   - The root element is placed at top-center
   - Children are arranged in rows below their parent, evenly spaced
   - Edge waypoints are computed as straight lines between shape centers
   - This produces a basic but readable layout for testing/demonstration
5. **Updates the diagram resource** (PUT) with all the generated blank node elements
6. **Navigates to the diagram** in the column view, which triggers the Diagram tab to render it

**Traversal control:**

- Default depth: 2 (root → children → grandchildren)
- All outgoing link predicates are followed (no filtering in initial implementation)
- Cycles are detected and broken (a resource already visited is not traversed again, but an edge is still created to it)
- The traversal depth and predicate filtering are candidates for future UI controls

**Note:** This auto-generation is an initial capability for testing and demonstration. Future iterations will add interactive layout editing, predicate filtering, depth controls, and manual diagram authoring.

### SVG Property Mapping

| DD Property | SVG Attribute | Notes |
|-------------|--------------|-------|
| `dd:fillColor` | `fill` | |
| `dd:fillOpacity` | `fill-opacity` | |
| `dd:strokeColor` | `stroke` | |
| `dd:strokeWidth` | `stroke-width` | |
| `dd:strokeOpacity` | `stroke-opacity` | |
| `dd:strokeDashLength` + `dd:strokeDashGap` | `stroke-dasharray` | |
| `dd:fontSize` | `font-size` | |
| `dd:fontName` | `font-family` | |
| `dd:fontColor` | `fill` (on `<text>`) | |
| `dd:fontBold` | `font-weight: bold` | |
| `dd:fontItalic` | `font-style: italic` | |
| `dd:fontUnderline` | `text-decoration: underline` | |
| `dd:fontStrikeThrough` | `text-decoration: line-through` | |
| `dd:x`, `dd:y` | `x`, `y` / `cx`, `cy` | `cx`, `cy` for `<ellipse>` (center = x + width/2, y + height/2) |
| `dd:width`, `dd:height` | `width`, `height` / `rx`, `ry` | For `<ellipse>`: `rx` = width/2, `ry` = height/2 |

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
| 1 | `DD.ttl` | `oslc-server/config/vocab/` (new directory) | DD ontology vocabulary |
| 1 | `DD-Shapes.ttl` | `oslc-server/config/vocab/` | DD ResourceShapes |
| 2 | `MRMS-DiagramStyles.ttl` | `mrm-server/config/vocab/` | Shared styles for MRM types |
| 2 | `MRMS-DiagramShapes.ttl` | `mrm-server/config/vocab/` | Diagram type ResourceShapes |
| 3 | `catalog-template.ttl` | `mrm-server/config/` | Extended with diagram services |
| 4 | `DiagramTab.tsx` | `oslc-browser/src/components/` | Diagram tab in details panel |
| 4 | `DiagramCanvas.tsx` | `oslc-browser/src/components/` | SVG viewport with pan/zoom |
| 4 | `DiagramShape.tsx` | `oslc-browser/src/components/` | Shape SVG rendering |
| 4 | `DiagramEdge.tsx` | `oslc-browser/src/components/` | Edge SVG rendering |
| 4 | `DiagramToolbar.tsx` | `oslc-browser/src/components/` | Zoom/fit controls |
| 4 | `diagramGenerator.ts` | `oslc-browser/src/hooks/` | Auto-generation: traversal, layout, style assignment |
