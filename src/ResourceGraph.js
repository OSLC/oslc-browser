import React, { Component } from 'react';
import { ReactCytoscape, cytoscape } from 'react-cytoscape';
import contextMenus from 'cytoscape-context-menus';
import jquery from 'jquery';
import './ResourceGraph.css';
import styles from './ResourceGraph.css.js';
import async from 'async';
import PreviewDialog from './PreviewDialog';
import filter from './DefaultFilters';

const Entities = require('html-entities').XmlEntities;
const entities = new Entities();


class ResourceGraph extends Component {

  constructor(props) {
    super(props);
    contextMenus(cytoscape, jquery); // register the extension
    cytoscape.use(contextMenus)
    this.state = {
      focusResource: null,
      dialog: null, // the preview Dialog
      isOpened: false
    }
    this.getElements = this.getElements.bind(this);
    this.layout = null;

    this.openInEditor = this.openInEditor.bind(this);
    this.showPreview = this.showPreview.bind(this);
    this.handlePreviewClosed = this.handlePreviewClosed.bind(this);
 }

  getElements() {
    const { resource } = this.props;
    if (!resource) return null;
    return [
      {
        group: 'nodes',
        data: {
          id: resource.getURI(),
          label: entities.decode(resource.getTitle()),
          expanded: false
        },
        scratch: {_resource: resource},
        position: {x: 50, y: 50},
        selected: false,
        selectable: true,
        locked: false,
        grabble: true,
        classes: 'node'
      }
    ]
  }

  openInEditor(event) {
  	let resource = event.target.scratch()._resource;
    window.open(resource.getURI());
  }

  showPreview(event) {
  	 let resource = event.target.scratch()._resource;
     this.setState({dialog: resource.getSmallPreview(), isOpened: true});
  }

  handlePreviewClosed(event) {
    this.setState({dialog: null, isOpened: false});
  }



  render() {
    return (
    	<div>
	      <ReactCytoscape 
	        containerID="cy"
	        elements={this.getElements()}
	        cyRef={(cy) => { this.cyRef(cy) }}
	        selectionType='additive'
	        cytoscapeOptions={{ 
	        	wheelSensitivity: 0.1, 
		        zoom: 1,
	  				pan: { x: 50, y: 50 }
	        }}
	        layout={{ name: 'dagre', fit: false }} 
	  			style={styles}
	  			/>
	      <PreviewDialog dialog={this.state.dialog} open={this.state.isOpened} onDialogClose={this.handlePreviewClosed}/>
	      </div>
	    );
  }

  cyRef(cy) {
  	const self = this;
    self.cy = cy;
    const { server } = self.props;

    if (!self.layout) {
    	self.layout = cy.layout({
    		name: 'dagre', fit: false
    	});
    }

    var contextMenu = cy.contextMenus({
    	menuItems: [
				{
	        id: 'showPreview',
	        content: 'Show preview...',
	        tooltipText: 'Show preview',
	        selector: 'node',
	        onClickFunction: this.showPreview,
	        disabled: false
				},
				{
	        id: 'openInEditor',
	        content: 'Open in editor...',
	        tooltipText: 'Open the selected resource in its native editor',
	        selector: 'node',
	        onClickFunction: this.openInEditor,
	        disabled: false
				}
			]
    });

		cy.on('tap', 'node', function(e){
		    var sel = e.target;
		    cy.elements().difference(sel.outgoers()).not(sel).addClass('semitransp');
		    sel.addClass('highlight').outgoers().addClass('highlight');
		});

		cy.on('tapend', 'node', function(e){
		    var sel = e.target;
		    cy.elements().removeClass('semitransp');
		    sel.removeClass('highlight').outgoers().removeClass('highlight');
		});

		cy.on('unselect', 'node', function(e){
		    var sel = e.target;
		    cy.elements().removeClass('semitransp');
		    cy.elements().removeClass('highlight');
		});

    cy.on('taphold', 'node', function (evt) {
      var node = evt.target;
      let elements = [];  // the nodes (artifacts) and edges (links) we want to add to the graph
      // GET the resource, we currently only have its Compact representation
      server.read(node.id(), function(err, resource) {
        if (err) {
            console.log(`Could not read resource, status: ${err}`);
            return(err);
        }
        let linkTypes = resource.getLinkTypes();
        linkTypes = [...linkTypes].filter((linkType) => {
          return !filter.filterLink(linkType);
        });
        linkTypes.forEach((link) => {
          // Get the compact representation of the target artifact
          let targets = resource.get(link);
          targets = Array.isArray(targets)?targets: [targets];
          let options = {
            uri: null,
            headers: {
            'Accept': 'application/x-oslc-compact+xml;q=0.5,application/rdf+xml;q=0.4',
            'OSLC-Core-Version': '2.0'}
          };

          async.forEach(targets, (targetURI, callback) => {
            options.uri = targetURI;
            server.read(options, (err, targetResource) => {
              if (!err) {
              	// Add the new related artifact node
						    let label = targetResource.getTitle();
						    if (!label) label = targetResource.getTitle();
						    if (!label) label = targetResource.getURI(); // the label of last resort 
						    label = entities.decode(label);  // Some dcterms:title properties are HTML encoded
                elements.push({
                  group: 'nodes',
			            data: {
			              id: targetResource.getURI(),
			              label: label,
			              expanded: false
			            },
			            scratch: {_resource: targetResource},
			            selected: false,
			            selectable: true,
			            locked: false,
			            grabble: true
			            // classes: 'node'
			          });
			          // add the edge for the source to target link
			          // Trim off the prefix for display purposes for the link label
			          let localPart = link.substring(link.lastIndexOf('/')+1);
        				localPart = localPart.substring(localPart.lastIndexOf('#')+1);
                elements.push({
                  group: 'edges',
			            data: {
                    // don't specify id to have a system generated unique identifier
			              label: localPart,
			              source: resource.getURI(),
			              target: targetResource.getURI(),
			              expanded: false
			              //classes: 'edge'
			            }
			          });
                return callback();          
              } else {
                console.log(`Could not read linked resource ${targetURI}, status: ${err}`);
                return callback()
              }
            });
			    }, err => {
            // add the new elements (nodes and edges) to the graph
			      cy.add(elements);
			      let layout = cy.layout({ name: 'dagre', fit: false });
			      layout.run();     
			    });
      	}); // forEach link
    	}); // read
    }); // on tap
  } // cyRef

  handleEval() {
    const cy = this.cy;
    const str = this.text.value;
    eval(str);
  }
}

export default ResourceGraph;
