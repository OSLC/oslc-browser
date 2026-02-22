import { useState, useEffect } from 'react';
import type { OSLCResource } from 'oslc-client';
import OSLCClient from 'oslc-client';
import './App.css';
import './RelationshipsAccordion.css';

// Define types for our application
interface Relationship {
  predicate: string;
  resources: OSLCResource[];
  expanded: boolean;
  loading: boolean;
}

interface ColumnItem extends OSLCResource {
  selected: boolean;
  loading: boolean;
  title?: string;
  name?: string;
  children?: ColumnItem[];
  relationships?: Relationship[];
  expanded?: boolean;
}

// Initialize OSLC client
const oslcClient = new OSLCClient({
  baseUrl: 'http://localhost:8080/oslc', // Replace with your OSLC server URL
  auth: {
    user: 'username', // Replace with your credentials
    password: 'password',
  },
});

function App() {
  const [columns, setColumns] = useState<ColumnItem[][]>([[]]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial service providers
  useEffect(() => {
    const loadServiceProviders = async () => {
      try {
        setLoading(true);
        const serviceProviders = await oslcClient.getServiceProviders();
        
        // Transform service providers to our column items
        const items: ColumnItem[] = serviceProviders.map((provider: OSLCResource) => ({
          ...provider,
          selected: false,
          loading: false,
          children: []
        }));
        
        setColumns([items]);
      } catch (err) {
        console.error('Failed to load service providers:', err);
        setError('Failed to load service providers. Please check the console for details.');
      } finally {
        setLoading(false);
      }
    };

    loadServiceProviders();
  }, []);

  // Handle item selection
  const handleSelectItem = async (item: ColumnItem, columnIndex: number) => {
    // Update selection state
    const newColumns = [...columns];
    
    // Clear selection in current and subsequent columns
    for (let i = 0; i < newColumns.length; i++) {
      newColumns[i] = newColumns[i].map(colItem => ({
        ...colItem,
        selected: colItem['@id'] === item['@id'] && i === columnIndex,
        expanded: colItem['@id'] === item['@id'] && i === columnIndex 
          ? !colItem.expanded 
          : colItem.expanded
      }));
    }
    
    // If this is the last column or we need to add a new one
    if (columnIndex === columns.length - 1 || columns.length <= columnIndex) {
      // Remove all columns after the current one
      newColumns.splice(columnIndex + 1);
      
      try {
        // Set loading state for the selected item
        newColumns[columnIndex] = newColumns[columnIndex].map(colItem => ({
          ...colItem,
          loading: colItem['@id'] === item['@id']
        }));
        setColumns([...newColumns]);
        
        if (!item['@id']) {
          throw new Error('Selected item has no ID');
        }
        
        // Fetch children for the selected item
        const children = await oslcClient.getResourceChildren(item['@id'] || '');
        
        // Transform children to our column items
        const childItems: ColumnItem[] = children.map((child: OSLCResource) => ({
          ...child,
          title: child['dcterms:title'] || child.title || 'Unnamed Resource',
          selected: false,
          loading: false,
          children: [],
          relationships: [],
          expanded: false
        }));
        
        // Add new column with children
        newColumns.push(childItems);
      } catch (err) {
        console.error('Failed to load resource children:', err);
        setError('Failed to load resource children. Please check the console for details.');
      }
    }
    
    // Update the columns
    setColumns([...newColumns]);
  };

  // Toggle relationship expansion
  const toggleRelationship = (columnIndex: number, itemIndex: number, relIndex: number) => {
    const newColumns = [...columns];
    const item = newColumns[columnIndex][itemIndex];
    
    if (item.relationships && item.relationships[relIndex]) {
      const relationships = [...(item.relationships || [])];
      relationships[relIndex] = {
        ...relationships[relIndex],
        expanded: !relationships[relIndex].expanded
      };
      
      newColumns[columnIndex] = [
        ...newColumns[columnIndex].slice(0, itemIndex),
        { ...item, relationships },
        ...newColumns[columnIndex].slice(itemIndex + 1)
      ];
      
      setColumns(newColumns);
    }
  };

  // Handle clicking on a relationship item
  const handleRelationshipClick = async (e: React.MouseEvent, columnIndex: number, itemIndex: number, relIndex: number) => {
    e.stopPropagation();
    
    const newColumns = [...columns];
    const item = newColumns[columnIndex][itemIndex];
    
    if (!item.relationships || !item.relationships[relIndex]) return;
    
    // Toggle expansion
    toggleRelationship(columnIndex, itemIndex, relIndex);
    
    const relationship = item.relationships[relIndex];
    
    // If we're expanding and haven't loaded resources yet
    if (relationship.expanded && (!relationship.resources || relationship.resources.length === 0)) {
      // Mark as loading
      const relationships = [...(item.relationships || [])];
      relationships[relIndex] = {
        ...relationships[relIndex],
        loading: true
      };
      
      newColumns[columnIndex] = [
        ...newColumns[columnIndex].slice(0, itemIndex),
        { ...item, relationships },
        ...newColumns[columnIndex].slice(itemIndex + 1)
      ];
      
      setColumns(newColumns);
      
      try {
        // In a real implementation, you would fetch the related resources here
        // For now, we'll use a placeholder with proper typing
        const relatedResources: OSLCResource[] = []; // await oslcClient.getRelatedResources(item['@id'], relationship.predicate);
        
        // Update with the loaded resources
        const updatedRelationships = [...(item.relationships || [])];
        updatedRelationships[relIndex] = {
          ...updatedRelationships[relIndex],
          resources: relatedResources,
          loading: false
        };
        
        const updatedColumns = [...columns];
        updatedColumns[columnIndex] = [
          ...updatedColumns[columnIndex].slice(0, itemIndex),
          { ...item, relationships: updatedRelationships },
          ...updatedColumns[columnIndex].slice(itemIndex + 1)
        ];
        
        setColumns(updatedColumns);
      } catch (error) {
        console.error('Failed to load related resources:', error);
        // Update to show error state
        const updatedRelationships = [...(item.relationships || [])];
        updatedRelationships[relIndex] = {
          ...updatedRelationships[relIndex],
          loading: false,
          resources: []
        };
        
        const updatedColumns = [...columns];
        updatedColumns[columnIndex] = [
          ...updatedColumns[columnIndex].slice(0, itemIndex),
          { ...item, relationships: updatedRelationships },
          ...updatedColumns[columnIndex].slice(itemIndex + 1)
        ];
        
        setColumns(updatedColumns);
      }
    }
  };

  // Render a single column
  const renderColumn = (items: ColumnItem[], columnIndex: number) => (
    <div key={columnIndex} className="column">
      <div className="column-header">
        {columnIndex === 0 ? 'Service Providers' : `Level ${columnIndex + 1}`}
      </div>
      <div className="items-list">
        {items.map((item, itemIndex) => (
          <div
            key={item['@id'] || itemIndex}
            className={`item ${item.selected ? 'selected' : ''}`}
            onClick={() => handleSelectItem(item, columnIndex)}
          >
            <div className="item-header">
              <div className="item-title">
                {item.title || item.name || item['dcterms:title'] || 'Unnamed Resource'}
                {item.loading && <span className="loading-indicator">↻</span>}
              </div>
              <div className="item-type">
                {Array.isArray(item['@type']) 
                  ? item['@type'].join(', ')
                  : item['@type'] || 'Resource'}
              </div>
            </div>
            
            {/* Relationships Accordion */}
            {item.expanded && item.relationships && item.relationships.length > 0 && (
              <div className="relationships-accordion">
                {item.relationships.map((rel, relIndex) => (
                  <div key={rel.predicate} className="relationship">
                    <div 
                      className="relationship-header"
                      onClick={(e) => handleRelationshipClick(e, columnIndex, itemIndex, relIndex)}
                    >
                      <span className="relationship-title">
                        {rel.predicate}
                        {rel.loading && <span className="loading-indicator">↻</span>}
                      </span>
                      <span className="relationship-arrow">
                        {rel.expanded ? '▼' : '▶'}
                      </span>
                    </div>
                    
                    {rel.expanded && (
                      <div className="relationship-content">
                        {rel.loading ? (
                          <div className="loading">Loading...</div>
                        ) : rel.resources && rel.resources.length > 0 ? (
                          <div className="related-resources">
                            {rel.resources.map((resource, resIndex) => (
                              <div 
                                key={resource['@id'] || resIndex}
                                className="related-resource"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Handle clicking on a related resource
                                  // This would typically navigate to or select the resource
                                }}
                              >
                                {resource['dcterms:title'] || resource.title || 'Unnamed Resource'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-resources">No related resources found</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return <div className="loading">Loading service providers...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>OSLC Resource Browser</h1>
      </header>
      <div className="browser-container">
        {columns.map((columnItems, index) => renderColumn(columnItems, index))}
      </div>
    </div>
  );
}

export default App;
