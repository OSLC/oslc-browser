# OSLC Diagram Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OSLC diagram support using OMG Diagram Definition, with reusable DD vocabulary, MRM-specific diagram types, catalog services, and SVG rendering in oslc-browser.

**Architecture:** Diagrams are OSLC AM resources (dd:Diagram extends oslc_am:Resource) containing blank-node shapes/edges that reference model elements. The browser renders diagrams as SVG in a details panel tab, and can auto-generate diagrams by traversing model element relationships.

**Tech Stack:** RDF/Turtle vocabularies, OSLC ResourceShapes, React 19 + TypeScript + MUI 7, SVG rendering, rdflib.js

**Spec:** `docs/superpowers/specs/2026-03-14-oslc-diagram-support-design.md`

---

## Chunk 1: Phase 1 — DD RDF Vocabulary and ResourceShapes

### Task 1: Create DD Vocabulary (DD.ttl)

**Files:**
- Create: `oslc-server/config/vocab/DD.ttl`

- [ ] **Step 1: Create the vocab directory**

```bash
mkdir -p oslc-server/config/vocab
```

- [ ] **Step 2: Write DD.ttl**

Create `oslc-server/config/vocab/DD.ttl` with the full OMG Diagram Definition ontology. Follow the prefix and class declaration pattern from `mrm-server/config/vocab/MRMS.ttl`.

```turtle
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix dc11:    <http://purl.org/dc/elements/1.1/> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix oslc_am: <http://open-services.net/ns/am#> .
@prefix dd:      <http://www.omg.org/spec/DD#> .

# Ontology declaration
<http://www.omg.org/spec/DD>
  a owl:Ontology ;
  owl:imports <http://open-services.net/ns/am> ;
  dc11:title "OMG Diagram Definition Vocabulary" ;
  dc11:description "RDF vocabulary for the OMG Diagram Definition (DD) metamodel, adapted for OSLC." .

# ---- Core Classes ----

dd:Diagram
  a rdfs:Class ;
  rdfs:subClassOf oslc_am:Resource ;
  dc11:description "A top-level diagram container. Inherits dcterms:title and dcterms:description from oslc_am:Resource." .

dd:DiagramElement
  a rdfs:Class ;
  dc11:description "Abstract base class for visual elements in a diagram. Modeled as blank nodes." .

dd:Shape
  a rdfs:Class ;
  rdfs:subClassOf dd:DiagramElement ;
  dc11:description "A diagram element with bounds (position and size)." .

dd:Edge
  a rdfs:Class ;
  rdfs:subClassOf dd:DiagramElement ;
  dc11:description "A connection between two diagram elements." .

# ---- Geometry Classes ----

dd:Bounds
  a rdfs:Class ;
  dc11:description "A rectangle defined by x, y, width, and height." .

dd:Point
  a rdfs:Class ;
  dc11:description "A coordinate pair (x, y)." .

# ---- Style Classes ----

dd:Style
  a rdfs:Class ;
  dc11:description "Abstract base class for visual styling of diagram elements." .

dd:SharedStyle
  a rdfs:Class ;
  rdfs:subClassOf dd:Style ;
  dc11:description "A reusable named style that can be shared across diagram elements." .

# ---- Diagram Properties ----

dd:resolution
  a rdf:Property ;
  rdfs:domain dd:Diagram ;
  rdfs:range xsd:double ;
  dc11:description "The rendering resolution of the diagram." .

dd:diagramElement
  a rdf:Property ;
  rdfs:domain dd:Diagram ;
  rdfs:range dd:DiagramElement ;
  dc11:description "A top-level element contained in this diagram." .

# ---- DiagramElement Properties ----

dd:modelElement
  a rdf:Property ;
  rdfs:domain dd:DiagramElement ;
  rdfs:range rdfs:Resource ;
  dc11:description "The model element that this diagram element represents." .

dd:owningElement
  a rdf:Property ;
  rdfs:domain dd:DiagramElement ;
  rdfs:range dd:DiagramElement ;
  dc11:description "The parent element that contains this element." .

dd:ownedElement
  a rdf:Property ;
  rdfs:domain dd:DiagramElement ;
  rdfs:range dd:DiagramElement ;
  dc11:description "A nested child element contained within this element." .

dd:localStyle
  a rdf:Property ;
  rdfs:domain dd:DiagramElement ;
  rdfs:range dd:Style ;
  dc11:description "A style applied directly to this element." .

dd:sharedStyle
  a rdf:Property ;
  rdfs:domain dd:DiagramElement ;
  rdfs:range dd:SharedStyle ;
  dc11:description "A reference to a shared, reusable style." .

# ---- Shape Properties ----

dd:bounds
  a rdf:Property ;
  rdfs:domain dd:Shape ;
  rdfs:range dd:Bounds ;
  dc11:description "The position and size of this shape." .

# ---- Edge Properties ----

dd:source
  a rdf:Property ;
  rdfs:domain dd:Edge ;
  rdfs:range dd:DiagramElement ;
  dc11:description "The source diagram element of this edge." .

dd:target
  a rdf:Property ;
  rdfs:domain dd:Edge ;
  rdfs:range dd:DiagramElement ;
  dc11:description "The target diagram element of this edge." .

dd:waypoint
  a rdf:Property ;
  rdfs:domain dd:Edge ;
  rdfs:range rdf:List ;
  dc11:description "An ordered list of intermediate points defining the edge path." .

# ---- Bounds Properties ----

dd:x
  a rdf:Property ;
  rdfs:range xsd:double ;
  dc11:description "The x coordinate." .

dd:y
  a rdf:Property ;
  rdfs:range xsd:double ;
  dc11:description "The y coordinate." .

dd:width
  a rdf:Property ;
  rdfs:domain dd:Bounds ;
  rdfs:range xsd:double ;
  dc11:description "The width." .

dd:height
  a rdf:Property ;
  rdfs:domain dd:Bounds ;
  rdfs:range xsd:double ;
  dc11:description "The height." .

# ---- Style Properties ----

dd:fill
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:boolean ;
  dc11:description "Whether the element should be filled." .

dd:fillColor
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:string ;
  dc11:description "Fill color as a CSS color string." .

dd:fillOpacity
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:double ;
  dc11:description "Fill opacity (0.0 to 1.0)." .

dd:stroke
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:boolean ;
  dc11:description "Whether the element should have a stroke." .

dd:strokeColor
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:string ;
  dc11:description "Stroke color as a CSS color string." .

dd:strokeWidth
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:double ;
  dc11:description "Stroke width in pixels." .

dd:strokeOpacity
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:double ;
  dc11:description "Stroke opacity (0.0 to 1.0)." .

dd:strokeDashLength
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:double ;
  dc11:description "Length of dashes in a dashed stroke." .

dd:strokeDashGap
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:double ;
  dc11:description "Gap between dashes in a dashed stroke." .

dd:fontSize
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:double ;
  dc11:description "Font size in points." .

dd:fontName
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:string ;
  dc11:description "Font family name." .

dd:fontColor
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:string ;
  dc11:description "Font color as a CSS color string." .

dd:fontBold
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:boolean ;
  dc11:description "Whether font is bold." .

dd:fontItalic
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:boolean ;
  dc11:description "Whether font is italic." .

dd:fontUnderline
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:boolean ;
  dc11:description "Whether font is underlined." .

dd:fontStrikeThrough
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:boolean ;
  dc11:description "Whether font has strikethrough." .

dd:shapeType
  a rdf:Property ;
  rdfs:domain dd:Style ;
  rdfs:range xsd:string ;
  dc11:description "Shape rendering hint: rect, ellipse, roundedRect, diamond, stickFigure." .
```

- [ ] **Step 3: Validate Turtle syntax**

```bash
cd oslc-server && npx rapper -i turtle -c config/vocab/DD.ttl 2>&1 || echo "If rapper not available, visually verify syntax"
```

If `rapper` is not installed, verify the file loads without error by checking prefix consistency and that all URIs are properly terminated with ` .`

- [ ] **Step 4: Commit**

```bash
git add oslc-server/config/vocab/DD.ttl
git commit -m "feat: add OMG Diagram Definition RDF vocabulary (DD.ttl)"
```

---

### Task 2: Create DD ResourceShapes (DD-Shapes.ttl)

**Files:**
- Create: `oslc-server/config/vocab/DD-Shapes.ttl`

- [ ] **Step 1: Write DD-Shapes.ttl**

Follow the reusable property pattern from `mrm-server/config/vocab/MRMS-Shapes.ttl` (lines 20-50). Each property is defined once and referenced by multiple shapes.

```turtle
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix oslc:    <http://open-services.net/ns/core#> .
@prefix oslc_am: <http://open-services.net/ns/am#> .
@prefix dd:      <http://www.omg.org/spec/DD#> .

# ============================================================
# Reusable Property Definitions
# These are shared across multiple ResourceShapes.
# ============================================================

# ---- Inherited AM Properties ----

<#p-title>
  a oslc:Property ;
  oslc:name "title" ;
  oslc:propertyDefinition dcterms:title ;
  dcterms:description "Title of the resource." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:string .

<#p-description>
  a oslc:Property ;
  oslc:name "description" ;
  oslc:propertyDefinition dcterms:description ;
  dcterms:description "Description of the resource." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

<#p-identifier>
  a oslc:Property ;
  oslc:name "identifier" ;
  oslc:propertyDefinition dcterms:identifier ;
  dcterms:description "Unique identifier of the resource." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:string .

<#p-type>
  a oslc:Property ;
  oslc:name "type" ;
  oslc:propertyDefinition rdf:type ;
  dcterms:description "RDF type(s) of the resource." ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:Resource ;
  oslc:representation oslc:Reference .

# ---- Diagram Properties ----

<#p-resolution>
  a oslc:Property ;
  oslc:name "resolution" ;
  oslc:propertyDefinition dd:resolution ;
  dcterms:description "Rendering resolution of the diagram." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-diagramElement>
  a oslc:Property ;
  oslc:name "diagramElement" ;
  oslc:propertyDefinition dd:diagramElement ;
  dcterms:description "A top-level element in this diagram." ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

# ---- DiagramElement Properties ----

<#p-modelElement>
  a oslc:Property ;
  oslc:name "modelElement" ;
  oslc:propertyDefinition dd:modelElement ;
  dcterms:description "The model element this diagram element represents." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType oslc:Resource ;
  oslc:representation oslc:Reference .

<#p-owningElement>
  a oslc:Property ;
  oslc:name "owningElement" ;
  oslc:propertyDefinition dd:owningElement ;
  dcterms:description "The parent element containing this element." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

<#p-ownedElement>
  a oslc:Property ;
  oslc:name "ownedElement" ;
  oslc:propertyDefinition dd:ownedElement ;
  dcterms:description "A nested child element." ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

<#p-localStyle>
  a oslc:Property ;
  oslc:name "localStyle" ;
  oslc:propertyDefinition dd:localStyle ;
  dcterms:description "Style applied directly to this element." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

<#p-sharedStyle>
  a oslc:Property ;
  oslc:name "sharedStyle" ;
  oslc:propertyDefinition dd:sharedStyle ;
  dcterms:description "Reference to a shared reusable style." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType oslc:Resource ;
  oslc:representation oslc:Reference .

# ---- Shape Properties ----

<#p-bounds>
  a oslc:Property ;
  oslc:name "bounds" ;
  oslc:propertyDefinition dd:bounds ;
  dcterms:description "Position and size of the shape." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

# ---- Edge Properties ----

<#p-source>
  a oslc:Property ;
  oslc:name "source" ;
  oslc:propertyDefinition dd:source ;
  dcterms:description "The source diagram element." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

<#p-target>
  a oslc:Property ;
  oslc:name "target" ;
  oslc:propertyDefinition dd:target ;
  dcterms:description "The target diagram element." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

<#p-waypoint>
  a oslc:Property ;
  oslc:name "waypoint" ;
  oslc:propertyDefinition dd:waypoint ;
  dcterms:description "Ordered list of intermediate points (rdf:List of dd:Point)." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

# ---- Geometry Properties ----

<#p-x>
  a oslc:Property ;
  oslc:name "x" ;
  oslc:propertyDefinition dd:x ;
  dcterms:description "X coordinate." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:double .

<#p-y>
  a oslc:Property ;
  oslc:name "y" ;
  oslc:propertyDefinition dd:y ;
  dcterms:description "Y coordinate." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:double .

<#p-width>
  a oslc:Property ;
  oslc:name "width" ;
  oslc:propertyDefinition dd:width ;
  dcterms:description "Width." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:double .

<#p-height>
  a oslc:Property ;
  oslc:name "height" ;
  oslc:propertyDefinition dd:height ;
  dcterms:description "Height." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:double .

# ---- Style Properties ----

<#p-fill>
  a oslc:Property ;
  oslc:name "fill" ;
  oslc:propertyDefinition dd:fill ;
  dcterms:description "Whether to fill." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:boolean .

<#p-fillColor>
  a oslc:Property ;
  oslc:name "fillColor" ;
  oslc:propertyDefinition dd:fillColor ;
  dcterms:description "Fill color (CSS color)." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

<#p-fillOpacity>
  a oslc:Property ;
  oslc:name "fillOpacity" ;
  oslc:propertyDefinition dd:fillOpacity ;
  dcterms:description "Fill opacity (0-1)." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-stroke>
  a oslc:Property ;
  oslc:name "stroke" ;
  oslc:propertyDefinition dd:stroke ;
  dcterms:description "Whether to stroke." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:boolean .

<#p-strokeColor>
  a oslc:Property ;
  oslc:name "strokeColor" ;
  oslc:propertyDefinition dd:strokeColor ;
  dcterms:description "Stroke color (CSS color)." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

<#p-strokeWidth>
  a oslc:Property ;
  oslc:name "strokeWidth" ;
  oslc:propertyDefinition dd:strokeWidth ;
  dcterms:description "Stroke width in pixels." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-strokeOpacity>
  a oslc:Property ;
  oslc:name "strokeOpacity" ;
  oslc:propertyDefinition dd:strokeOpacity ;
  dcterms:description "Stroke opacity (0-1)." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-strokeDashLength>
  a oslc:Property ;
  oslc:name "strokeDashLength" ;
  oslc:propertyDefinition dd:strokeDashLength ;
  dcterms:description "Dash length." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-strokeDashGap>
  a oslc:Property ;
  oslc:name "strokeDashGap" ;
  oslc:propertyDefinition dd:strokeDashGap ;
  dcterms:description "Gap between dashes." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-fontSize>
  a oslc:Property ;
  oslc:name "fontSize" ;
  oslc:propertyDefinition dd:fontSize ;
  dcterms:description "Font size in points." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-fontName>
  a oslc:Property ;
  oslc:name "fontName" ;
  oslc:propertyDefinition dd:fontName ;
  dcterms:description "Font family name." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

<#p-fontColor>
  a oslc:Property ;
  oslc:name "fontColor" ;
  oslc:propertyDefinition dd:fontColor ;
  dcterms:description "Font color (CSS color)." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

<#p-fontBold>
  a oslc:Property ;
  oslc:name "fontBold" ;
  oslc:propertyDefinition dd:fontBold ;
  dcterms:description "Whether font is bold." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:boolean .

<#p-fontItalic>
  a oslc:Property ;
  oslc:name "fontItalic" ;
  oslc:propertyDefinition dd:fontItalic ;
  dcterms:description "Whether font is italic." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:boolean .

<#p-fontUnderline>
  a oslc:Property ;
  oslc:name "fontUnderline" ;
  oslc:propertyDefinition dd:fontUnderline ;
  dcterms:description "Whether font is underlined." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:boolean .

<#p-fontStrikeThrough>
  a oslc:Property ;
  oslc:name "fontStrikeThrough" ;
  oslc:propertyDefinition dd:fontStrikeThrough ;
  dcterms:description "Whether font has strikethrough." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:boolean .

<#p-shapeType>
  a oslc:Property ;
  oslc:name "shapeType" ;
  oslc:propertyDefinition dd:shapeType ;
  dcterms:description "Shape rendering hint: rect, ellipse, roundedRect, diamond, stickFigure." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

# ============================================================
# ResourceShape Definitions
# ============================================================

<#DiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Diagram" ;
  oslc:describes dd:Diagram ;
  oslc:property
    <#p-title>, <#p-description>, <#p-identifier>, <#p-type>,
    <#p-resolution>, <#p-diagramElement> .

<#ShapeShape>
  a oslc:ResourceShape ;
  dcterms:title "Shape" ;
  oslc:describes dd:Shape ;
  oslc:property
    <#p-type>, <#p-modelElement>, <#p-localStyle>,
    <#p-sharedStyle>, <#p-bounds>, <#p-ownedElement> .

<#EdgeShape>
  a oslc:ResourceShape ;
  dcterms:title "Edge" ;
  oslc:describes dd:Edge ;
  oslc:property
    <#p-type>, <#p-modelElement>, <#p-localStyle>,
    <#p-sharedStyle>, <#p-source>, <#p-target>, <#p-waypoint> .

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
  oslc:property
    <#p-fill>, <#p-fillColor>, <#p-fillOpacity>,
    <#p-stroke>, <#p-strokeColor>, <#p-strokeWidth>,
    <#p-strokeOpacity>, <#p-strokeDashLength>, <#p-strokeDashGap>,
    <#p-fontSize>, <#p-fontName>, <#p-fontColor>,
    <#p-fontBold>, <#p-fontItalic>, <#p-fontUnderline>,
    <#p-fontStrikeThrough>, <#p-shapeType> .

<#SharedStyleShape>
  a oslc:ResourceShape ;
  dcterms:title "SharedStyle" ;
  oslc:describes dd:SharedStyle ;
  oslc:property
    <#p-title>,
    <#p-fill>, <#p-fillColor>, <#p-fillOpacity>,
    <#p-stroke>, <#p-strokeColor>, <#p-strokeWidth>,
    <#p-strokeOpacity>, <#p-strokeDashLength>, <#p-strokeDashGap>,
    <#p-fontSize>, <#p-fontName>, <#p-fontColor>,
    <#p-fontBold>, <#p-fontItalic>, <#p-fontUnderline>,
    <#p-fontStrikeThrough>, <#p-shapeType> .
```

- [ ] **Step 2: Validate Turtle syntax**

Verify prefix consistency and proper statement termination.

- [ ] **Step 3: Commit**

```bash
git add oslc-server/config/vocab/DD-Shapes.ttl
git commit -m "feat: add DD ResourceShapes (DD-Shapes.ttl)"
```

---

## Chunk 2: Phase 2 — MRM Diagram Type Definitions

### Task 3: Create MRM Diagram Shared Styles (MRMS-DiagramStyles.ttl)

**Files:**
- Create: `mrm-server/config/vocab/MRMS-DiagramStyles.ttl`

- [ ] **Step 1: Write MRMS-DiagramStyles.ttl**

Each MRM resource type gets a `dd:SharedStyle` instance with visual properties matching the SIAM reference image.

```turtle
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix dd:      <http://www.omg.org/spec/DD#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

# ============================================================
# MRM Shared Styles for Diagram Elements
# Each style maps an MRM resource type to its visual appearance.
# ============================================================

mrm:OrgUnitStyle
  a dd:SharedStyle ;
  dcterms:title "Organization Unit Style" ;
  dd:shapeType "rect" ;
  dd:fill true ;
  dd:fillColor "#cce5ff" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#004085" ;
  dd:strokeWidth 1.5 ;
  dd:fontSize 12.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#004085" .

mrm:ProgramStyle
  a dd:SharedStyle ;
  dcterms:title "Program Style" ;
  dd:shapeType "rect" ;
  dd:fill true ;
  dd:fillColor "#d4edda" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#155724" ;
  dd:strokeWidth 1.5 ;
  dd:fontSize 12.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#155724" .

mrm:ServiceStyle
  a dd:SharedStyle ;
  dcterms:title "Service Style" ;
  dd:shapeType "roundedRect" ;
  dd:fill true ;
  dd:fillColor "#c3e6cb" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#155724" ;
  dd:strokeWidth 1.0 ;
  dd:fontSize 11.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#155724" .

mrm:ProcessStyle
  a dd:SharedStyle ;
  dcterms:title "Process Style" ;
  dd:shapeType "ellipse" ;
  dd:fill true ;
  dd:fillColor "#e2e3e5" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#383d41" ;
  dd:strokeWidth 1.0 ;
  dd:fontSize 10.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#383d41" .

mrm:ResourceStyle
  a dd:SharedStyle ;
  dcterms:title "Resource Style" ;
  dd:shapeType "rect" ;
  dd:fill true ;
  dd:fillColor "#fff3cd" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#856404" ;
  dd:strokeWidth 1.0 ;
  dd:strokeDashLength 5.0 ;
  dd:strokeDashGap 3.0 ;
  dd:fontSize 11.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#856404" .

mrm:OutcomeStyle
  a dd:SharedStyle ;
  dcterms:title "Outcome Style" ;
  dd:shapeType "ellipse" ;
  dd:fill true ;
  dd:fillColor "#d1ecf1" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#0c5460" ;
  dd:strokeWidth 1.0 ;
  dd:fontSize 10.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#0c5460" .

mrm:OutputStyle
  a dd:SharedStyle ;
  dcterms:title "Output Style" ;
  dd:shapeType "rect" ;
  dd:fill true ;
  dd:fillColor "#f8f9fa" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#6c757d" ;
  dd:strokeWidth 0.5 ;
  dd:fontSize 10.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#6c757d" .

mrm:NeedStyle
  a dd:SharedStyle ;
  dcterms:title "Need Style" ;
  dd:shapeType "ellipse" ;
  dd:fill true ;
  dd:fillColor "#f5c6cb" ;
  dd:fillOpacity 1.0 ;
  dd:stroke true ;
  dd:strokeColor "#721c24" ;
  dd:strokeWidth 1.0 ;
  dd:fontSize 10.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#721c24" .

mrm:TargetGroupStyle
  a dd:SharedStyle ;
  dcterms:title "Target Group Style" ;
  dd:shapeType "stickFigure" ;
  dd:fill false ;
  dd:stroke true ;
  dd:strokeColor "#333333" ;
  dd:strokeWidth 1.5 ;
  dd:fontSize 10.0 ;
  dd:fontName "Arial" ;
  dd:fontColor "#333333" .

mrm:HierarchyEdgeStyle
  a dd:SharedStyle ;
  dcterms:title "Hierarchy Edge Style" ;
  dd:stroke true ;
  dd:strokeColor "#333333" ;
  dd:strokeWidth 1.0 .

mrm:ContributoryEdgeStyle
  a dd:SharedStyle ;
  dcterms:title "Contributory Edge Style" ;
  dd:stroke true ;
  dd:strokeColor "#555555" ;
  dd:strokeWidth 1.0 .
```

- [ ] **Step 2: Commit**

```bash
git add mrm-server/config/vocab/MRMS-DiagramStyles.ttl
git commit -m "feat: add MRM diagram shared styles (MRMS-DiagramStyles.ttl)"
```

---

### Task 4: Create MRM Diagram ResourceShapes (MRMS-DiagramShapes.ttl)

**Files:**
- Create: `mrm-server/config/shapes/MRMS-DiagramShapes.ttl`

**Note:** This file goes in `mrm-server/config/shapes/` (not `vocab/`) because the catalog-template.ttl references shapes via `<shapes/...>` which resolves relative to the config directory. This matches the existing pattern where `MRMS-Shapes.ttl` lives in `config/shapes/`.

- [ ] **Step 1: Write MRMS-DiagramShapes.ttl**

This file defines one ResourceShape per diagram type. Type constraints on model elements are documentation-level only (in `dcterms:description`), not shape-enforced.

```turtle
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix oslc:    <http://open-services.net/ns/core#> .
@prefix oslc_am: <http://open-services.net/ns/am#> .
@prefix dd:      <http://www.omg.org/spec/DD#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

# ============================================================
# Reusable Property Definitions (duplicated from DD-Shapes.ttl
# because Turtle files are self-contained; these must match
# the definitions in oslc-server/config/vocab/DD-Shapes.ttl)
# ============================================================

<#p-title>
  a oslc:Property ;
  oslc:name "title" ;
  oslc:propertyDefinition dcterms:title ;
  dcterms:description "Title of the diagram." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:string .

<#p-description>
  a oslc:Property ;
  oslc:name "description" ;
  oslc:propertyDefinition dcterms:description ;
  dcterms:description "Description of the diagram." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:string .

<#p-identifier>
  a oslc:Property ;
  oslc:name "identifier" ;
  oslc:propertyDefinition dcterms:identifier ;
  dcterms:description "Unique identifier." ;
  oslc:occurs oslc:Exactly-one ;
  oslc:valueType xsd:string .

<#p-type>
  a oslc:Property ;
  oslc:name "type" ;
  oslc:propertyDefinition rdf:type ;
  dcterms:description "RDF type(s)." ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:Resource ;
  oslc:representation oslc:Reference .

<#p-resolution>
  a oslc:Property ;
  oslc:name "resolution" ;
  oslc:propertyDefinition dd:resolution ;
  dcterms:description "Rendering resolution." ;
  oslc:occurs oslc:Zero-or-one ;
  oslc:valueType xsd:double .

<#p-diagramElement>
  a oslc:Property ;
  oslc:name "diagramElement" ;
  oslc:propertyDefinition dd:diagramElement ;
  dcterms:description "Top-level element in this diagram." ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:AnyResource ;
  oslc:representation oslc:Inline .

# ============================================================
# Hierarchy Diagram Shapes (one per hierarchical MRM type)
# ============================================================

<#OrgUnitDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Organization Unit Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing OrganizationUnit parent-child relationships. Shapes reference mrm:OrganizationUnit model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#ProgramDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Program Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing Program parent-child relationships. Shapes reference mrm:Program model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#ServiceDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Service Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing Service parent-child relationships. Shapes reference mrm:Service model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#ProcessDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Process Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing Process parent-child relationships. Shapes reference mrm:Process model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#ResourceDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Resource Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing Resource parent-child relationships. Shapes reference mrm:Resource model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#NeedDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Need Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing Need parent-child relationships. Shapes reference mrm:Need model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#OutcomeDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Outcome Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing Outcome parent-child relationships. Shapes reference mrm:Outcome model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#OutputDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Output Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing Output parent-child relationships. Shapes reference mrm:Output model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#TargetGroupDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Target Group Hierarchy Diagram" ;
  dcterms:description "A hierarchy diagram showing TargetGroup parent-child relationships. Shapes reference mrm:TargetGroup model elements. Edges use mrm:HierarchyEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

# ============================================================
# Composite Diagram Shapes
# ============================================================

<#PLMDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Program Logic Model Diagram" ;
  dcterms:description "Shows contributory relationships: Program to Services to Outputs to Outcomes. Shapes reference mrm:Program, mrm:Service, mrm:Output, and mrm:Outcome model elements. Edges use mrm:ContributoryEdgeStyle." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .

<#SIAMDiagramShape>
  a oslc:ResourceShape ;
  dcterms:title "Service Integrated Accountability Model Diagram" ;
  dcterms:description "Traces accountability chains from OrganizationUnit or Program through Services and Processes to Outputs and TargetGroups. Multiple shape styles coexist. Layout is generally top-down." ;
  oslc:describes dd:Diagram ;
  oslc:property <#p-title>, <#p-description>, <#p-identifier>,
    <#p-type>, <#p-resolution>, <#p-diagramElement> .
```

- [ ] **Step 2: Commit**

```bash
git add mrm-server/config/shapes/MRMS-DiagramShapes.ttl
git commit -m "feat: add MRM diagram type ResourceShapes (MRMS-DiagramShapes.ttl)"
```

---

## Chunk 3: Phase 3 — MRM Catalog Template Extensions

### Task 5: Extend mrm-server catalog-template.ttl with Diagram Services

**Files:**
- Modify: `mrm-server/config/catalog-template.ttl`

**Context:** The existing file has 202 lines with 4 prefixes (lines 1-4: `dcterms:`, `rdf:`, `oslc:`, `mrm:`), catalog properties (lines 8-15), a ServiceProvider (lines 19-21), a Service with 8 creation factories (lines 29-77), 8 creation dialogs (lines 80-151), and 8 query capabilities (lines 155-202). The service currently declares `oslc:domain mrm: ;` (line 25). Existing shapes are referenced via `<shapes/MRMS-Shapes#...>` which resolves to `mrm-server/config/shapes/`.

- [ ] **Step 1: Add dd: prefix**

Add `@prefix dd: <http://www.omg.org/spec/DD#> .` after line 4 in `mrm-server/config/catalog-template.ttl`.

- [ ] **Step 2: Add dd: to service domain**

Change line 25 from:
```turtle
  oslc:domain mrm: ;
```
to:
```turtle
  oslc:domain mrm:, dd: ;
```

- [ ] **Step 3: Add diagram creation factories**

After the last existing creation factory (line 77, the Needs factory), add 11 new creation factories — one for each hierarchy diagram type (9), plus PLM and SIAM:

```turtle
  # ---- Diagram Creation Factories ----

  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Organization Unit Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OrgUnitDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Program Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ProgramDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Service Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ServiceDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Process Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ProcessDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Resource Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ResourceDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Need Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#NeedDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Outcome Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OutcomeDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Output Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OutputDiagramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Create Target Group Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#TargetGroupDiagramShape>
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

- [ ] **Step 4: Add diagram creation dialogs**

After the last existing creation dialog, add 11 matching creation dialogs:

```turtle
  # ---- Diagram Creation Dialogs ----

  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Organization Unit Diagram" ;
    oslc:label "New OrgUnit Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OrgUnitDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Program Diagram" ;
    oslc:label "New Program Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ProgramDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Service Diagram" ;
    oslc:label "New Service Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ServiceDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Process Diagram" ;
    oslc:label "New Process Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ProcessDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Resource Diagram" ;
    oslc:label "New Resource Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#ResourceDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Need Diagram" ;
    oslc:label "New Need Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#NeedDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Outcome Diagram" ;
    oslc:label "New Outcome Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OutcomeDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Output Diagram" ;
    oslc:label "New Output Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#OutputDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create Target Group Diagram" ;
    oslc:label "New TargetGroup Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#TargetGroupDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create PLM Diagram" ;
    oslc:label "New PLM Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#PLMDiagramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "Create SIAM Diagram" ;
    oslc:label "New SIAM Diagram" ;
    oslc:resourceType dd:Diagram ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-DiagramShapes#SIAMDiagramShape>
  ] ;
```

- [ ] **Step 5: Add diagram selection dialog**

After the creation dialogs section, add one selection dialog for diagrams:

```turtle
  # ---- Diagram Selection Dialog (new pattern for MRM) ----

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

**No diagram-specific query capabilities are needed.** Diagrams are queryable through the existing MRM query capabilities using `oslc.where` clauses (e.g., filtering by `rdf:type=dd:Diagram`).

- [ ] **Step 6: Validate the complete file**

Verify that:
- All prefix declarations are consistent
- All semicolons and periods are correct (semicolons between properties of same subject, period at end)
- Shape paths match the fragment identifiers in `MRMS-DiagramShapes.ttl` (e.g., `#OrgUnitDiagramShape`)

- [ ] **Step 7: Commit**

```bash
git add mrm-server/config/catalog-template.ttl
git commit -m "feat: extend MRM catalog template with diagram services"
```

---

## Chunk 4: Phase 4 — oslc-browser Diagram Rendering (Types and Data Parsing)

### Task 6: Add Diagram Types (Generic, Vocabulary-Driven)

**Files:**
- Create: `oslc-browser/src/models/diagram-types.ts`

- [ ] **Step 1: Create diagram-types.ts**

This file defines only the DD namespace URI (for detection) and runtime data structures. All property recognition is done generically by extracting the local name from DD-namespaced predicates found in the RDF data — no hardcoded property URI map.

```typescript
/** The DD namespace URI — used only for type detection, not property matching */
export const DD_NS = 'http://www.omg.org/spec/DD#';

/**
 * Extract the local name from a URI (the part after # or last /).
 * Used to map RDF predicate URIs to property keys generically.
 */
export function localName(uri: string): string {
  const hashIdx = uri.lastIndexOf('#');
  if (hashIdx >= 0) return uri.substring(hashIdx + 1);
  const slashIdx = uri.lastIndexOf('/');
  if (slashIdx >= 0) return uri.substring(slashIdx + 1);
  return uri;
}

/** Check if a URI belongs to the DD namespace */
export function isDDProperty(predicateURI: string): boolean {
  return predicateURI.startsWith(DD_NS);
}

/** Check if a resource is a dd:Diagram by its rdf:type URIs */
export function isDiagram(resourceTypes: string[]): boolean {
  return resourceTypes.some(t => t === DD_NS + 'Diagram');
}

/** Check if a resource is a dd:Shape */
export function isShape(resourceTypes: string[]): boolean {
  return resourceTypes.some(t => t === DD_NS + 'Shape');
}

/** Check if a resource is a dd:Edge */
export function isEdge(resourceTypes: string[]): boolean {
  return resourceTypes.some(t => t === DD_NS + 'Edge');
}

// ---- Runtime data structures (populated by generic RDF parsing) ----

export interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramPoint {
  x: number;
  y: number;
}

/**
 * Style properties collected generically from dd:Style blank nodes.
 * Keys are DD local names (e.g., "fillColor", "shapeType").
 * Values are strings — the renderer coerces to number/boolean as needed
 * based on the local name.
 */
export type DiagramStyle = Record<string, string>;

export interface DiagramShapeData {
  id: string;                    // blank node ID
  type: 'shape';
  modelElementURI?: string;      // URI of the OSLC model element
  modelElementTitle?: string;    // resolved title (from compact)
  bounds: DiagramBounds;
  style: DiagramStyle;
}

export interface DiagramEdgeData {
  id: string;                    // blank node ID
  type: 'edge';
  modelElementURI?: string;
  sourceId: string;              // blank node ID of source shape
  targetId: string;              // blank node ID of target shape
  waypoints: DiagramPoint[];
  style: DiagramStyle;
}

export type DiagramElementData = DiagramShapeData | DiagramEdgeData;

export interface ParsedDiagram {
  uri: string;
  title: string;
  elements: DiagramElementData[];
  elementMap: Map<string, DiagramElementData>;
}
```

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/models/diagram-types.ts
git commit -m "feat: add generic vocabulary-driven diagram types"
```

---

### Task 7: Create Diagram Data Parser (Generic)

**Files:**
- Create: `oslc-browser/src/hooks/useDiagramData.ts`

- [ ] **Step 1: Create useDiagramData.ts**

This hook parses a `LoadedResource` (when it's a diagram) into `ParsedDiagram` by walking the blank node (inline resource) structure generically. It identifies DD properties by namespace, not by hardcoded URIs. Style properties are collected as a key/value map keyed by local name.

```typescript
import { useMemo } from 'react';
import { LoadedResource } from '../models/types';
import {
  DD_NS,
  isDDProperty,
  localName,
  isDiagram,
  isShape,
  isEdge,
  DiagramBounds,
  DiagramEdgeData,
  DiagramElementData,
  DiagramPoint,
  DiagramStyle,
  ParsedDiagram,
} from '../models/diagram-types';

// ---- Generic helpers for reading LoadedResource data ----

function getPropertyValue(
  resource: LoadedResource,
  predicate: string
): string | undefined {
  const prop = resource.properties.find(p => p.predicate === predicate);
  return prop?.value;
}

function getLinkURI(
  resource: LoadedResource,
  predicate: string
): string | undefined {
  const link = resource.links.find(l => l.predicate === predicate);
  return link?.targetURI;
}

function getInlineResource(
  resource: LoadedResource,
  predicate: string
): LoadedResource | undefined {
  const linkURI = getLinkURI(resource, predicate);
  if (!linkURI || !resource.inlineResources) return undefined;
  return resource.inlineResources[linkURI];
}

function getInlineResources(
  resource: LoadedResource,
  predicate: string
): LoadedResource[] {
  const results: LoadedResource[] = [];
  if (!resource.inlineResources) return results;
  for (const link of resource.links) {
    if (link.predicate === predicate) {
      const inline = resource.inlineResources[link.targetURI];
      if (inline) results.push(inline);
    }
  }
  return results;
}

/**
 * Find an inline resource linked via a DD-namespaced predicate
 * identified by local name (e.g., "bounds", "localStyle").
 */
function getDDInlineResource(
  resource: LoadedResource,
  ddLocalName: string
): LoadedResource | undefined {
  return getInlineResource(resource, DD_NS + ddLocalName);
}

/**
 * Find a link URI via a DD-namespaced predicate identified by local name.
 */
function getDDLinkURI(
  resource: LoadedResource,
  ddLocalName: string
): string | undefined {
  return getLinkURI(resource, DD_NS + ddLocalName);
}

// ---- Generic style parsing ----

/**
 * Parse all DD-namespaced properties on a style resource into a
 * key/value map keyed by local name. No hardcoded property list —
 * any dd: property found on the style is included.
 */
function parseStyle(styleResource: LoadedResource): DiagramStyle {
  const style: DiagramStyle = {};
  for (const prop of styleResource.properties) {
    if (isDDProperty(prop.predicate)) {
      style[localName(prop.predicate)] = prop.value;
    }
  }
  return style;
}

// ---- Generic bounds parsing ----

function parseBounds(boundsResource: LoadedResource): DiagramBounds {
  const get = (name: string) => {
    const val = getPropertyValue(boundsResource, DD_NS + name);
    return val !== undefined ? parseFloat(val) : 0;
  };
  return {
    x: get('x'),
    y: get('y'),
    width: get('width') || 100,
    height: get('height') || 60,
  };
}

// ---- Generic element parsing ----

function parseElement(element: LoadedResource): DiagramElementData | null {
  const types = element.resourceTypes;
  const modelElementURI = getDDLinkURI(element, 'modelElement');

  // Parse style generically from localStyle inline blank node
  let style: DiagramStyle = {};
  const localStyleRes = getDDInlineResource(element, 'localStyle');
  if (localStyleRes) {
    style = parseStyle(localStyleRes);
  }
  // sharedStyle is a reference URI — would need separate fetch;
  // for now fall back to localStyle or empty style

  if (isShape(types)) {
    const boundsRes = getDDInlineResource(element, 'bounds');
    const bounds = boundsRes ? parseBounds(boundsRes) : { x: 0, y: 0, width: 100, height: 60 };
    return {
      id: element.uri,
      type: 'shape',
      modelElementURI,
      bounds,
      style,
    };
  }

  if (isEdge(types)) {
    const sourceURI = getDDLinkURI(element, 'source');
    const targetURI = getDDLinkURI(element, 'target');
    if (!sourceURI || !targetURI) return null;
    // Waypoints: for now, empty array (straight line between source/target)
    const waypoints: DiagramPoint[] = [];
    return {
      id: element.uri,
      type: 'edge',
      modelElementURI,
      sourceId: sourceURI,
      targetId: targetURI,
      waypoints,
      style,
    };
  }

  return null;
}

// ---- Main parser ----

export function parseDiagramResource(resource: LoadedResource): ParsedDiagram | null {
  if (!isDiagram(resource.resourceTypes)) return null;

  const elements: DiagramElementData[] = [];
  const elementMap = new Map<string, DiagramElementData>();

  // Find top-level diagram elements via dd:diagramElement predicate
  const diagramElements = getInlineResources(resource, DD_NS + 'diagramElement');
  for (const el of diagramElements) {
    const parsed = parseElement(el);
    if (parsed) {
      elements.push(parsed);
      elementMap.set(parsed.id, parsed);
    }
  }

  return {
    uri: resource.uri,
    title: resource.title,
    elements,
    elementMap,
  };
}

export function useDiagramData(resource: LoadedResource | null): ParsedDiagram | null {
  return useMemo(() => {
    if (!resource) return null;
    return parseDiagramResource(resource);
  }, [resource]);
}
```

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/hooks/useDiagramData.ts
git commit -m "feat: add generic vocabulary-driven diagram data parser"
```

---

## Chunk 5: Phase 4 — oslc-browser Diagram Rendering (SVG Components)

### Task 8: Create DiagramShape Component

**Files:**
- Create: `oslc-browser/src/components/DiagramShape.tsx`

- [ ] **Step 1: Write DiagramShape.tsx**

Renders a single shape as SVG elements based on `dd:shapeType` from the style. Note: for ellipses, `rx = width/2`, `ry = height/2`, and center = `(x + width/2, y + height/2)`.

```tsx
import React from 'react';
import { DiagramShapeData, DiagramStyle } from '../models/diagram-types';

interface DiagramShapeProps {
  shape: DiagramShapeData;
  onClick?: (modelElementURI: string) => void;
}

/** Read a style property as string, with fallback */
function s(style: DiagramStyle, key: string, fallback: string = ''): string {
  return style[key] ?? fallback;
}

/** Read a style property as number, with fallback */
function n(style: DiagramStyle, key: string, fallback: number = 0): number {
  const val = style[key];
  return val !== undefined ? parseFloat(val) : fallback;
}

/** Read a style property as boolean */
function b(style: DiagramStyle, key: string): boolean | undefined {
  const val = style[key];
  if (val === undefined) return undefined;
  return val === 'true' || val === '1';
}

function renderShapeSVG(shape: DiagramShapeData): React.ReactNode {
  const { bounds, style } = shape;
  const { x, y, width, height } = bounds;
  const fill = s(style, 'fillColor', '#ffffff');
  const fillOpacity = n(style, 'fillOpacity', 1);
  const strokeColor = s(style, 'strokeColor', '#333333');
  const strokeW = n(style, 'strokeWidth', 1);
  const strokeOpacity = n(style, 'strokeOpacity', 1);
  const dashArray =
    style['strokeDashLength'] && style['strokeDashGap']
      ? `${style['strokeDashLength']} ${style['strokeDashGap']}`
      : undefined;

  const commonProps = {
    fill: b(style, 'fill') === false ? 'none' : fill,
    fillOpacity,
    stroke: b(style, 'stroke') === false ? 'none' : strokeColor,
    strokeWidth: strokeW,
    strokeOpacity,
    strokeDasharray: dashArray,
  };

  const shapeType = s(style, 'shapeType', 'rect');

  switch (shapeType) {
    case 'ellipse':
      return (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          {...commonProps}
        />
      );
    case 'roundedRect':
      return (
        <rect
          x={x} y={y} width={width} height={height}
          rx={8} ry={8}
          {...commonProps}
        />
      );
    case 'diamond': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const points = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
      return <polygon points={points} {...commonProps} />;
    }
    case 'stickFigure': {
      const cx = x + width / 2;
      const headR = Math.min(width, height) * 0.15;
      const headCy = y + headR;
      const bodyTop = y + headR * 2;
      const bodyBottom = y + height * 0.6;
      const armY = bodyTop + (bodyBottom - bodyTop) * 0.3;
      return (
        <g stroke={strokeColor} strokeWidth={strokeW} fill="none">
          <circle cx={cx} cy={headCy} r={headR} />
          <line x1={cx} y1={bodyTop} x2={cx} y2={bodyBottom} />
          <line x1={x + width * 0.2} y1={armY} x2={x + width * 0.8} y2={armY} />
          <line x1={cx} y1={bodyBottom} x2={x + width * 0.25} y2={y + height} />
          <line x1={cx} y1={bodyBottom} x2={x + width * 0.75} y2={y + height} />
        </g>
      );
    }
    case 'rect':
    default:
      return (
        <rect
          x={x} y={y} width={width} height={height}
          {...commonProps}
        />
      );
  }
}

export function DiagramShape({ shape, onClick }: DiagramShapeProps) {
  const { bounds, style, modelElementURI, modelElementTitle } = shape;
  const fontSize = n(style, 'fontSize', 11);
  const fontFamily = s(style, 'fontName', 'Arial, sans-serif');
  const fontColor = s(style, 'fontColor', '#333333');
  const fontWeight = b(style, 'fontBold') ? 'bold' : 'normal';
  const fStyle = b(style, 'fontItalic') ? 'italic' : 'normal';
  const textDecoration = [
    b(style, 'fontUnderline') ? 'underline' : '',
    b(style, 'fontStrikeThrough') ? 'line-through' : '',
  ].filter(Boolean).join(' ') || undefined;

  const title = modelElementTitle ?? modelElementURI ?? '';

  const handleClick = () => {
    if (modelElementURI && onClick) onClick(modelElementURI);
  };

  return (
    <g
      style={{ cursor: modelElementURI ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      <title>{title}</title>
      {renderShapeSVG(shape)}
      {s(style, 'shapeType', 'rect') !== 'stickFigure' && (
        <text
          x={bounds.x + bounds.width / 2}
          y={bounds.y + bounds.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={fontColor}
          fontWeight={fontWeight}
          fontStyle={fStyle}
          textDecoration={textDecoration}
        >
          {title}
        </text>
      )}
      {s(style, 'shapeType', 'rect') === 'stickFigure' && (
        <text
          x={bounds.x + bounds.width / 2}
          y={bounds.y + bounds.height + 14}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={fontColor}
        >
          {title}
        </text>
      )}
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/components/DiagramShape.tsx
git commit -m "feat: add DiagramShape SVG rendering component"
```

---

### Task 9: Create DiagramEdge Component

**Files:**
- Create: `oslc-browser/src/components/DiagramEdge.tsx`

- [ ] **Step 1: Write DiagramEdge.tsx**

Renders an edge as an SVG path from the center of the source shape bounds, through waypoints, to the center of the target shape bounds, with an arrowhead marker.

```tsx
import React from 'react';
import { DiagramEdgeData, DiagramShapeData, DiagramElementData, DiagramStyle } from '../models/diagram-types';

interface DiagramEdgeProps {
  edge: DiagramEdgeData;
  elementMap: Map<string, DiagramElementData>;
}

function getShapeCenter(shape: DiagramShapeData): { x: number; y: number } {
  return {
    x: shape.bounds.x + shape.bounds.width / 2,
    y: shape.bounds.y + shape.bounds.height / 2,
  };
}

export function DiagramEdge({ edge, elementMap }: DiagramEdgeProps) {
  const sourceEl = elementMap.get(edge.sourceId);
  const targetEl = elementMap.get(edge.targetId);
  if (!sourceEl || !targetEl || sourceEl.type !== 'shape' || targetEl.type !== 'shape') {
    return null;
  }

  const source = getShapeCenter(sourceEl);
  const target = getShapeCenter(targetEl);

  const points = [source, ...edge.waypoints, target];
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');

  const style = edge.style;
  const strokeColor = style['strokeColor'] ?? '#333333';
  const strokeW = style['strokeWidth'] ? parseFloat(style['strokeWidth']) : 1;
  const strokeOpacity = style['strokeOpacity'] ? parseFloat(style['strokeOpacity']) : 1;
  const dashArray =
    style['strokeDashLength'] && style['strokeDashGap']
      ? `${style['strokeDashLength']} ${style['strokeDashGap']}`
      : undefined;

  return (
    <path
      d={d}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeW}
      strokeOpacity={strokeOpacity}
      strokeDasharray={dashArray}
      markerEnd="url(#arrowhead)"
    />
  );
}

/** SVG <defs> for arrowhead marker — include once in the parent SVG */
export function DiagramEdgeDefs() {
  return (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="10"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
      </marker>
    </defs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/components/DiagramEdge.tsx
git commit -m "feat: add DiagramEdge SVG rendering component"
```

---

### Task 10: Create DiagramToolbar Component

**Files:**
- Create: `oslc-browser/src/components/DiagramToolbar.tsx`

- [ ] **Step 1: Write DiagramToolbar.tsx**

Simple toolbar with zoom in/out and fit-to-view controls:

```tsx
import React from 'react';
import { IconButton, Toolbar, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';

interface DiagramToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
}

export function DiagramToolbar({ onZoomIn, onZoomOut, onFitToView }: DiagramToolbarProps) {
  return (
    <Toolbar variant="dense" sx={{ minHeight: 36, gap: 0.5 }}>
      <Tooltip title="Zoom In">
        <IconButton size="small" onClick={onZoomIn}><ZoomInIcon fontSize="small" /></IconButton>
      </Tooltip>
      <Tooltip title="Zoom Out">
        <IconButton size="small" onClick={onZoomOut}><ZoomOutIcon fontSize="small" /></IconButton>
      </Tooltip>
      <Tooltip title="Fit to View">
        <IconButton size="small" onClick={onFitToView}><FitScreenIcon fontSize="small" /></IconButton>
      </Tooltip>
    </Toolbar>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/components/DiagramToolbar.tsx
git commit -m "feat: add DiagramToolbar component"
```

---

### Task 11: Create DiagramCanvas Component

**Files:**
- Create: `oslc-browser/src/components/DiagramCanvas.tsx`

- [ ] **Step 1: Write DiagramCanvas.tsx**

SVG viewport with pan (drag) and zoom (scroll wheel). Renders all shapes and edges from the parsed diagram:

```tsx
import React, { useCallback, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { ParsedDiagram } from '../models/diagram-types';
import { DiagramShape } from './DiagramShape';
import { DiagramEdge, DiagramEdgeDefs } from './DiagramEdge';
import { DiagramToolbar } from './DiagramToolbar';

interface DiagramCanvasProps {
  diagram: ParsedDiagram;
  onNavigate: (uri: string) => void;
}

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const PADDING = 40;

function computeContentBounds(diagram: ParsedDiagram) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of diagram.elements) {
    if (el.type === 'shape') {
      minX = Math.min(minX, el.bounds.x);
      minY = Math.min(minY, el.bounds.y);
      maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
      maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 800, height: 600 };
  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}

export function DiagramCanvas({ diagram, onNavigate }: DiagramCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const contentBounds = computeContentBounds(diagram);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleZoomIn = useCallback(() =>
    setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const handleZoomOut = useCallback(() =>
    setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);
  const handleFitToView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const shapes = diagram.elements.filter(e => e.type === 'shape');
  const edges = diagram.elements.filter(e => e.type === 'edge');

  const viewBox = `${contentBounds.x} ${contentBounds.y} ${contentBounds.width / zoom} ${contentBounds.height / zoom}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DiagramToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToView={handleFitToView}
      />
      <Box sx={{ flex: 1, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={viewBox}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ display: 'block' }}
        >
          <DiagramEdgeDefs />
          <g transform={`translate(${pan.x / zoom},${pan.y / zoom})`}>
            {edges.map(e =>
              e.type === 'edge' ? (
                <DiagramEdge key={e.id} edge={e} elementMap={diagram.elementMap} />
              ) : null
            )}
            {shapes.map(s =>
              s.type === 'shape' ? (
                <DiagramShape key={s.id} shape={s} onClick={onNavigate} />
              ) : null
            )}
          </g>
        </svg>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/components/DiagramCanvas.tsx
git commit -m "feat: add DiagramCanvas SVG viewport component"
```

---

## Chunk 6: Phase 4 — oslc-browser Integration (Tab, Context Menu, Auto-Generation)

### Task 12: Create DiagramTab and Integrate into DetailsPanel

**Files:**
- Create: `oslc-browser/src/components/DiagramTab.tsx`
- Modify: `oslc-browser/src/components/DetailsPanel.tsx`

- [ ] **Step 1: Write DiagramTab.tsx**

```tsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { LoadedResource } from '../models/types';
import { useDiagramData } from '../hooks/useDiagramData';
import { DiagramCanvas } from './DiagramCanvas';

interface DiagramTabProps {
  resource: LoadedResource;
  onNavigate: (uri: string) => void;
}

export function DiagramTab({ resource, onNavigate }: DiagramTabProps) {
  const diagram = useDiagramData(resource);

  if (!diagram) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">Unable to parse diagram data.</Typography>
      </Box>
    );
  }

  if (diagram.elements.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">
          This diagram has no elements. Use the context menu on a resource to auto-generate diagram content.
        </Typography>
      </Box>
    );
  }

  return <DiagramCanvas diagram={diagram} onNavigate={onNavigate} />;
}
```

- [ ] **Step 2: Add Diagram tab to DetailsPanel.tsx**

Modify `oslc-browser/src/components/DetailsPanel.tsx` to add a conditional third tab when the resource is a `dd:Diagram`.

The existing file (36 lines) has two tabs: Properties (index 0) and Explorer (index 1). Add the Diagram tab import and conditional rendering:

Add import at top:
```typescript
import { DiagramTab } from './DiagramTab';
import { isDiagram } from '../models/diagram-types';
```

Add state for tab tracking and the conditional third tab. The key change: when the resource is a diagram, show a "Diagram" tab as the first tab (index 0), shifting Properties to index 1 and Explorer to index 2.

Alternatively (simpler): append "Diagram" as tab index 2, only visible when resource is a diagram. The implementation should:
1. Check `isDiagram(resource.resourceTypes)` to determine if the tab should appear
2. Render the `DiagramTab` component when selected
3. Pass `onLinkClick` as the `onNavigate` prop

- [ ] **Step 3: Commit**

```bash
git add oslc-browser/src/components/DiagramTab.tsx oslc-browser/src/components/DetailsPanel.tsx
git commit -m "feat: add Diagram tab to details panel"
```

---

### Task 13: Create Diagram Auto-Generator

**Files:**
- Create: `oslc-browser/src/hooks/diagramGenerator.ts`

- [ ] **Step 1: Write diagramGenerator.ts**

This module handles:
1. Traversing outgoing links from a root resource (depth 2)
2. Creating DD blank-node shapes/edges with default layout
3. Inlining styles as dd:localStyle based on resource type
4. Serializing the diagram as Turtle for POST/PUT to the server

```typescript
import { LoadedResource } from '../models/types';
import { DD, DiagramBounds } from '../models/diagram-types';

import { DiagramStyle } from '../models/diagram-types';

// Map MRM resource type URIs to inline style properties.
// These are inlined (dd:localStyle) rather than referenced as dd:sharedStyle
// because the diagram parser does not yet resolve sharedStyle references.
// Values match MRMS-DiagramStyles.ttl.
const TYPE_STYLE_MAP: Record<string, DiagramStyle> = {
  'http://www.misa.org.ca/mrm#OrganizationUnit': {
    shapeType: 'rect', fill: true, fillColor: '#cce5ff', strokeColor: '#004085',
    strokeWidth: 1.5, fontSize: 12, fontName: 'Arial', fontColor: '#004085',
  },
  'http://www.misa.org.ca/mrm#Program': {
    shapeType: 'rect', fill: true, fillColor: '#d4edda', strokeColor: '#155724',
    strokeWidth: 1.5, fontSize: 12, fontName: 'Arial', fontColor: '#155724',
  },
  'http://www.misa.org.ca/mrm#Service': {
    shapeType: 'roundedRect', fill: true, fillColor: '#c3e6cb', strokeColor: '#155724',
    strokeWidth: 1.0, fontSize: 11, fontName: 'Arial', fontColor: '#155724',
  },
  'http://www.misa.org.ca/mrm#Process': {
    shapeType: 'ellipse', fill: true, fillColor: '#e2e3e5', strokeColor: '#383d41',
    strokeWidth: 1.0, fontSize: 10, fontName: 'Arial', fontColor: '#383d41',
  },
  'http://www.misa.org.ca/mrm#Resource': {
    shapeType: 'rect', fill: true, fillColor: '#fff3cd', strokeColor: '#856404',
    strokeWidth: 1.0, strokeDashLength: 5, strokeDashGap: 3, fontSize: 11,
    fontName: 'Arial', fontColor: '#856404',
  },
  'http://www.misa.org.ca/mrm#Outcome': {
    shapeType: 'ellipse', fill: true, fillColor: '#d1ecf1', strokeColor: '#0c5460',
    strokeWidth: 1.0, fontSize: 10, fontName: 'Arial', fontColor: '#0c5460',
  },
  'http://www.misa.org.ca/mrm#Output': {
    shapeType: 'rect', fill: true, fillColor: '#f8f9fa', strokeColor: '#6c757d',
    strokeWidth: 0.5, fontSize: 10, fontName: 'Arial', fontColor: '#6c757d',
  },
  'http://www.misa.org.ca/mrm#Need': {
    shapeType: 'ellipse', fill: true, fillColor: '#f5c6cb', strokeColor: '#721c24',
    strokeWidth: 1.0, fontSize: 10, fontName: 'Arial', fontColor: '#721c24',
  },
  'http://www.misa.org.ca/mrm#TargetGroup': {
    shapeType: 'stickFigure', fill: false, strokeColor: '#333333',
    strokeWidth: 1.5, fontSize: 10, fontName: 'Arial', fontColor: '#333333',
  },
};

interface TraversedNode {
  uri: string;
  title: string;
  types: string[];
  depth: number;
}

interface TraversedEdge {
  sourceURI: string;
  targetURI: string;
  predicate: string;
}

interface TraversalResult {
  nodes: TraversedNode[];
  edges: TraversedEdge[];
}

export async function traverseLinks(
  rootResource: LoadedResource,
  fetchResource: (uri: string) => Promise<LoadedResource | null>,
  maxDepth: number = 2
): Promise<TraversalResult> {
  const visited = new Set<string>();
  const nodes: TraversedNode[] = [];
  const edges: TraversedEdge[] = [];
  const queue: Array<{ resource: LoadedResource; depth: number }> = [
    { resource: rootResource, depth: 0 },
  ];

  visited.add(rootResource.uri);
  nodes.push({
    uri: rootResource.uri,
    title: rootResource.title,
    types: rootResource.resourceTypes,
    depth: 0,
  });

  while (queue.length > 0) {
    const { resource, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    for (const link of resource.links) {
      const targetURI = link.targetURI;
      edges.push({
        sourceURI: resource.uri,
        targetURI,
        predicate: link.predicate,
      });

      if (!visited.has(targetURI)) {
        visited.add(targetURI);
        const targetResource = await fetchResource(targetURI);
        if (targetResource) {
          nodes.push({
            uri: targetURI,
            title: targetResource.title,
            types: targetResource.resourceTypes,
            depth: depth + 1,
          });
          queue.push({ resource: targetResource, depth: depth + 1 });
        }
      }
    }
  }

  return { nodes, edges };
}

// Simple tree layout: root at top center, children in rows
function computeLayout(
  nodes: TraversedNode[],
  edges: TraversedEdge[]
): Map<string, DiagramBounds> {
  const SHAPE_W = 140;
  const SHAPE_H = 50;
  const H_GAP = 30;
  const V_GAP = 60;

  // Group nodes by depth
  const byDepth = new Map<number, TraversedNode[]>();
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }

  const layout = new Map<string, DiagramBounds>();
  const maxDepth = Math.max(...Array.from(byDepth.keys()));

  for (let d = 0; d <= maxDepth; d++) {
    const row = byDepth.get(d) ?? [];
    const totalWidth = row.length * SHAPE_W + (row.length - 1) * H_GAP;
    const startX = -totalWidth / 2;
    const y = d * (SHAPE_H + V_GAP);

    for (let i = 0; i < row.length; i++) {
      layout.set(row[i].uri, {
        x: startX + i * (SHAPE_W + H_GAP),
        y,
        width: SHAPE_W,
        height: SHAPE_H,
      });
    }
  }

  return layout;
}

function getInlineStyle(types: string[]): DiagramStyle | undefined {
  for (const t of types) {
    if (TYPE_STYLE_MAP[t]) return TYPE_STYLE_MAP[t];
  }
  return undefined;
}

function serializeStyleTurtle(style: DiagramStyle): string {
  const lines: string[] = [];
  lines.push('    a dd:Style ;');
  if (style.shapeType) lines.push(`    dd:shapeType "${style.shapeType}" ;`);
  if (style.fill !== undefined) lines.push(`    dd:fill ${style.fill} ;`);
  if (style.fillColor) lines.push(`    dd:fillColor "${style.fillColor}" ;`);
  if (style.fillOpacity !== undefined) lines.push(`    dd:fillOpacity "${style.fillOpacity}"^^xsd:double ;`);
  if (style.stroke !== undefined) lines.push(`    dd:stroke ${style.stroke} ;`);
  if (style.strokeColor) lines.push(`    dd:strokeColor "${style.strokeColor}" ;`);
  if (style.strokeWidth !== undefined) lines.push(`    dd:strokeWidth "${style.strokeWidth}"^^xsd:double ;`);
  if (style.strokeDashLength !== undefined) lines.push(`    dd:strokeDashLength "${style.strokeDashLength}"^^xsd:double ;`);
  if (style.strokeDashGap !== undefined) lines.push(`    dd:strokeDashGap "${style.strokeDashGap}"^^xsd:double ;`);
  if (style.fontSize !== undefined) lines.push(`    dd:fontSize "${style.fontSize}"^^xsd:double ;`);
  if (style.fontName) lines.push(`    dd:fontName "${style.fontName}" ;`);
  if (style.fontColor) lines.push(`    dd:fontColor "${style.fontColor}" ;`);
  // Replace trailing ; on last line with empty (will be closed by caller)
  if (lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, '');
  }
  return lines.join('\n');
}

export function generateDiagramTurtle(
  title: string,
  traversal: TraversalResult,
  diagramURI: string
): string {
  const layout = computeLayout(traversal.nodes, traversal.edges);
  const lines: string[] = [];

  lines.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  lines.push('@prefix dcterms: <http://purl.org/dc/terms/> .');
  lines.push('@prefix dd: <http://www.omg.org/spec/DD#> .');
  lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
  lines.push('');
  lines.push(`<${diagramURI}>`);
  lines.push('  a dd:Diagram ;');
  lines.push(`  dcterms:title "${title}" ;`);

  // Generate blank node IDs for shapes
  const shapeIds = new Map<string, string>();
  traversal.nodes.forEach((node, i) => {
    shapeIds.set(node.uri, `_:shape${i}`);
  });

  // diagramElement references
  const allElementIds: string[] = [];
  traversal.nodes.forEach((_, i) => allElementIds.push(`_:shape${i}`));
  traversal.edges.forEach((_, i) => allElementIds.push(`_:edge${i}`));

  for (let i = 0; i < allElementIds.length; i++) {
    const sep = i < allElementIds.length - 1 ? ',' : '.';
    lines.push(`  dd:diagramElement ${allElementIds[i]} ${sep}`);
  }

  lines.push('');

  // Shape definitions — styles are inlined as dd:localStyle blank nodes
  // so the diagram parser can render them without resolving sharedStyle URIs
  for (let i = 0; i < traversal.nodes.length; i++) {
    const node = traversal.nodes[i];
    const bounds = layout.get(node.uri)!;
    const style = getInlineStyle(node.types);

    lines.push(`_:shape${i}`);
    lines.push('  a dd:Shape ;');
    lines.push(`  dd:modelElement <${node.uri}> ;`);
    if (style) {
      lines.push('  dd:localStyle [');
      lines.push(serializeStyleTurtle(style));
      lines.push('  ] ;');
    }
    lines.push(`  dd:bounds [`);
    lines.push(`    a dd:Bounds ;`);
    lines.push(`    dd:x "${bounds.x}"^^xsd:double ;`);
    lines.push(`    dd:y "${bounds.y}"^^xsd:double ;`);
    lines.push(`    dd:width "${bounds.width}"^^xsd:double ;`);
    lines.push(`    dd:height "${bounds.height}"^^xsd:double`);
    lines.push('  ] .');
    lines.push('');
  }

  // Edge definitions
  for (let i = 0; i < traversal.edges.length; i++) {
    const edge = traversal.edges[i];
    const sourceId = shapeIds.get(edge.sourceURI);
    const targetId = shapeIds.get(edge.targetURI);
    if (!sourceId || !targetId) continue;

    lines.push(`_:edge${i}`);
    lines.push('  a dd:Edge ;');
    lines.push(`  dd:source ${sourceId} ;`);
    lines.push(`  dd:target ${targetId} .`);
    lines.push('');
  }

  return lines.join('\n');
}
```

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/hooks/diagramGenerator.ts
git commit -m "feat: add diagram auto-generator (traversal, layout, Turtle serialization)"
```

---

### Task 14: Add "Create Diagram" Context Menu

**Files:**
- Modify: `oslc-browser/src/App.tsx`

- [ ] **Step 1: Add diagram creation menu items to App.tsx context menu**

The existing context menu (`App.tsx` lines 73-86) has a single "Add to Favorites" `MenuItem`. Extend it to include a "Create Diagram" submenu.

This requires:
1. Importing the diagram generator functions
2. Adding state for available diagram types (discovered from catalog introspection)
3. Adding a "Create Diagram" `MenuItem` with a nested submenu
4. Implementing the handler that:
   - Fetches the selected resource
   - Calls `traverseLinks()` to discover related resources
   - Calls `generateDiagramTurtle()` to create the diagram content
   - POSTs to the creation factory URL
   - Navigates to the new diagram

**Note:** The full context menu integration depends on how the catalog data is currently stored in the browser. The implementer should check `useOslcClient.ts` for how the catalog/service provider data is available, and use it to find creation factories with `oslc:resourceType dd:Diagram`.

The key function signature for the handler:

```typescript
async function handleCreateDiagram(factoryTitle: string, factoryURL: string) {
  const resource = await fetchResource(contextMenu.item.uri);
  if (!resource) return;
  const traversal = await traverseLinks(resource, fetchResource, 2);
  const diagramTitle = `${resource.title} - ${factoryTitle}`;
  const turtle = generateDiagramTurtle(diagramTitle, traversal, '');
  // POST turtle to factoryURL
  // Navigate to the returned diagram URI
}
```

The exact implementation details depend on how the oslc-client library exposes POST/PUT operations. The implementer should review `oslc-client/OSLCClient.js` for the available methods.

- [ ] **Step 2: Commit**

```bash
git add oslc-browser/src/App.tsx
git commit -m "feat: add Create Diagram context menu with auto-generation"
```

---

### Task 15: End-to-End Validation

- [ ] **Step 1: Build oslc-browser**

```bash
cd oslc-browser && npm run build
```

Verify no TypeScript compilation errors.

- [ ] **Step 2: Start mrm-server and verify catalog**

```bash
cd mrm-server && npm start
```

Navigate to the catalog endpoint and verify the diagram creation factories, dialogs, and query capabilities appear.

- [ ] **Step 3: Manual test — create and view a diagram**

1. Open oslc-browser, connect to mrm-server
2. Navigate to an OrganizationUnit resource
3. Right-click → Create Diagram → select a diagram type
4. Verify the diagram is created and the Diagram tab appears
5. Verify shapes render with correct styles and titles
6. Verify clicking a shape navigates to the model element

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete OSLC diagram support — DD vocab, MRM types, browser rendering"
```
