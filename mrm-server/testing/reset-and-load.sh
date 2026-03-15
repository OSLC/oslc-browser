#!/usr/bin/env bash
###############################################################################
# reset-and-load.sh — Flush the Fuseki /mrm dataset and recreate MRM data
#
# Prerequisites:
#   - Apache Jena Fuseki running at http://localhost:3030 with dataset /mrm
#   - mrm-server running at http://localhost:3002
#
# What this script does:
#   1. Drops all data from the Fuseki /mrm dataset
#   2. Creates the "City of Ottawa" and "City of Toronto" ServiceProviders
#   3. Creates sample MRM resources (Service, Process, OrgUnit, Program)
#   4. Creates the "MRMv2.1" ServiceProvider and imports MRMv2.1.ttl
#   5. Verifies import via SPARQL count query
###############################################################################

set -euo pipefail

FUSEKI_URL="http://localhost:3030/mrm"
MRM_URL="http://localhost:3002"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_FILE="$SCRIPT_DIR/../data/MRMv2.1.ttl"

# Colors for output (disabled if not a terminal)
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; NC=''
fi

info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# Check that required services are reachable
check_service() {
  local name="$1" url="$2"
  if ! curl -sf -o /dev/null --max-time 5 "$url"; then
    fail "$name is not reachable at $url"
  fi
}

# POST Turtle to mrm-server, expect 201 Created
# Body is read from stdin to avoid @prefix being treated as a file reference.
post_turtle() {
  local url="$1" slug="$2" body="$3" label="$4"
  local status
  status=$(printf '%s' "$body" | curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$url" \
    -H "Content-Type: text/turtle" \
    -H "Slug: $slug" \
    --data-binary @-)
  if [ "$status" = "201" ]; then
    info "$label (201)"
  elif [ "$status" = "409" ]; then
    warn "$label already exists (409) — skipping"
  else
    fail "$label — unexpected status $status"
  fi
}

# PUT file import to mrm-server, expect 200/204
put_file() {
  local url="$1" file="$2" label="$3"
  local status
  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -X PUT "$url" \
    -H "Content-Type: text/turtle" \
    --data-binary "@$file")
  if [ "$status" = "200" ] || [ "$status" = "204" ]; then
    info "$label ($status)"
  else
    fail "$label — unexpected status $status"
  fi
}

echo "============================================="
echo " MRM Dataset Reset & Load"
echo "============================================="
echo ""

# ---- Step 0: Verify prerequisites ----
echo "Checking services..."
check_service "Fuseki" "$FUSEKI_URL/data?default"
check_service "mrm-server" "$MRM_URL/oslc"
info "Both services are reachable"
echo ""

if [ ! -f "$DATA_FILE" ]; then
  fail "MRMv2.1.ttl not found at $DATA_FILE"
fi

# ---- Step 1: Flush the Fuseki dataset ----
echo "Step 1: Flushing Fuseki /mrm dataset..."
status=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "$FUSEKI_URL/update" \
  -H "Content-Type: application/sparql-update" \
  --data-binary "DROP ALL")
if [ "$status" = "200" ] || [ "$status" = "204" ]; then
  info "Dataset flushed (DROP ALL)"
else
  fail "Failed to flush dataset — status $status"
fi
echo ""

# ---- Step 2: Create ServiceProviders ----
echo "Step 2: Creating ServiceProviders..."

post_turtle "$MRM_URL/oslc" "city-of-ottawa" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
<> dcterms:title "City of Ottawa" ;
   dcterms:description "Municipal Reference Model for the City of Ottawa." .' \
  "ServiceProvider: City of Ottawa"

post_turtle "$MRM_URL/oslc" "city-of-toronto" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
<> dcterms:title "City of Toronto" ;
   dcterms:description "Municipal Reference Model for the City of Toronto." .' \
  "ServiceProvider: City of Toronto"
echo ""

# ---- Step 3: Create sample MRM resources in City of Ottawa ----
echo "Step 3: Creating sample resources..."

post_turtle "$MRM_URL/oslc/city-of-ottawa/resources" "water-distribution" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm: <http://www.misa.org.ca/mrm#> .
<> a mrm:Service ;
   dcterms:title "Water Distribution" ;
   dcterms:description "Provision of potable water to residents and businesses." ;
   dcterms:identifier "SVC-001" .' \
  "Resource: Water Distribution (Service)"

post_turtle "$MRM_URL/oslc/city-of-ottawa/resources" "water-quality-testing" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm: <http://www.misa.org.ca/mrm#> .
<> a mrm:Process ;
   dcterms:title "Water Quality Testing" ;
   dcterms:description "Regular testing of water quality at treatment plants and distribution points." ;
   dcterms:identifier "PRC-001" .' \
  "Resource: Water Quality Testing (Process)"

post_turtle "$MRM_URL/oslc/city-of-ottawa/resources" "public-works" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm: <http://www.misa.org.ca/mrm#> .
<> a mrm:OrganizationUnit ;
   dcterms:title "Public Works Department" ;
   dcterms:description "Responsible for infrastructure maintenance and public works services." ;
   dcterms:identifier "ORG-001" .' \
  "Resource: Public Works Department (OrganizationUnit)"

post_turtle "$MRM_URL/oslc/city-of-ottawa/resources" "infrastructure-renewal" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm: <http://www.misa.org.ca/mrm#> .
<> a mrm:Program ;
   dcterms:title "Infrastructure Renewal Program" ;
   dcterms:description "Multi-year program for renewal of aging municipal infrastructure." ;
   dcterms:identifier "PGM-001" .' \
  "Resource: Infrastructure Renewal Program (Program)"

# City of Toronto sample
post_turtle "$MRM_URL/oslc/city-of-toronto/resources" "transit-operations" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm: <http://www.misa.org.ca/mrm#> .
<> a mrm:Service ;
   dcterms:title "Transit Operations" ;
   dcterms:description "Public transit service including buses, streetcars, and subway operations." ;
   dcterms:identifier "SVC-101" .' \
  "Resource: Transit Operations (Service)"
echo ""

# ---- Step 4: Create MRMv2.1 ServiceProvider and import data ----
echo "Step 4: Creating MRMv2.1 ServiceProvider and importing data..."

post_turtle "$MRM_URL/oslc" "mrmv2-1" \
  '@prefix dcterms: <http://purl.org/dc/terms/> .
<> dcterms:title "MRMv2.1" ;
   dcterms:description "Municipal Reference Model v2.1 — imported reference data." .' \
  "ServiceProvider: MRMv2.1"

echo "  Importing MRMv2.1.ttl ($(wc -l < "$DATA_FILE") lines)..."
put_file "$MRM_URL/oslc/mrmv2-1/import" "$DATA_FILE" "MRMv2.1 data import"
echo ""

# ---- Step 5: Verify ----
echo "Step 5: Verifying import..."
echo ""
curl -s -X POST "$FUSEKI_URL/sparql" \
  -H "Accept: application/sparql-results+json" \
  -H "Content-Type: application/sparql-query" \
  --data-binary 'SELECT ?type (COUNT(?s) AS ?count) WHERE { ?s a ?type . } GROUP BY ?type ORDER BY DESC(?count)' \
  | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    results = data["results"]["bindings"]
    if not results:
        print("  (no results)")
    else:
        sep = "-"*70
        print(f"  {'Type':<70} Count")
        print(f"  {sep} -----")
        total = 0
        for r in results:
            t = r["type"]["value"]
            # Show local name for readability
            name = t.split("#")[-1] if "#" in t else t.split("/")[-1]
            c = int(r["count"]["value"])
            total += c
            print(f"  {name:<70} {c}")
        print(f"  {sep} -----")
        print(f"  {'Total':<70} {total}")
except Exception as e:
    print(f"  Could not parse SPARQL results: {e}", file=sys.stderr)
    print(sys.stdin.read() if hasattr(sys.stdin, "read") else "(no input)")
'
echo ""
echo "============================================="
echo " Done!"
echo "============================================="
