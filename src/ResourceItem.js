import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Accordion, AccordionItem, Link } from 'carbon-components-react';
import PreviewDialog from './PreviewDialog';

import { ContextMenuTrigger } from 'react-contextmenu';
import { ContextMenu } from 'react-contextmenu';
import { MenuItem } from 'react-contextmenu';

import filter from './DefaultFilters';

const Entities = require('html-entities').XmlEntities;
const entities = new Entities();

/*
 * A ResourceItem renders a specific OSLC Compact resource, and
 * if the resource is expanded, it GETs the resource and lists
 * its object properties. Selection on one of these properties
 * results in a new ResourcesColumn on the Compact representation
 * of the related resources.
 */
class ResourceItem extends Component {
  static propTypes = {
    resource: PropTypes.object, // An OSLC Compact resource
    server: PropTypes.object,    // An OSLCServer to use to access resources
    columnIndex: PropTypes.number, // column number from the left
    rowIndex: PropTypes.number, // row number from the top
    onLinkTypeSelected: PropTypes.func
  }

  static defaultProps = {
    resource: null,
    server: null
  }

  constructor(props) {
    super(props);
    this.state = {
      items: [], // children of the Accordion
      dialog: null, // the preview Dialog
      isOpened: false
    }

    this.resource = null;
    this.handleShowLinks = this.handleShowLinks.bind(this);
    this.handleLinkSelected = this.handleLinkSelected.bind(this);
    this.handleResourceSelected = this.handleResourceSelected.bind(this);
    this.handlePreviewSelected = this.handlePreviewSelected.bind(this);
    this.handlePreviewClosed = this.handlePreviewClosed.bind(this);
    this.openInEditor = this.openInEditor.bind(this);
    this.showPreview = this.showPreview.bind(this);
    this.showInExplorer = this.showInExplorer.bind(this);
  }

  /*
   * The ResourceItem's Accordion has been clicked (and expanded), 
   * get the link types (i.e., object properties) of the OSLCResource
   * and add them to the children of the Accordion. Re-read them every
   * time the Accordion is expanded to pick up and changes that may
   * have occurred.
   */
  handleShowLinks(event) {
    var self = this;
    const { resource, server } = this.props;
    let items = [];
    // read the full resource here, we only get the Compact representation from the parent
    server.read(resource.getURI(), function(err, resource) {
      if (err) {
          console.log(`Could not read resource, status: ${err}`);
          return(err);
      }
      self.resource = resource;  // save the resource we just read
      let linkTypes = resource.getLinkTypes();
      linkTypes = [...linkTypes].filter((linkType) => {
        return !filter.filterLink(linkType);
      });
      for (let link of linkTypes) {
        // Trim off the prefix for display purposes
        let localPart = link.substring(link.lastIndexOf('/')+1);
        localPart = localPart.substring(localPart.lastIndexOf('#')+1);
        if (!localPart.startsWith('_Y')) items.push(
          // don't use an href for the link as that will navigate to the OSLC Spec for the link type!
          <div key={link}><Link link={link} onClick={self.handleLinkSelected}>{localPart}</Link><br /></div>
        )
      }
      self.setState({items: items});
    });
  }

  /*
   * The resource was clicked (either expanded or contracted), let the parent 
   * components know
   */
  handleResourceSelected(event) {
    const { onResourceSelected, rowIndex, columnIndex } = this.props;
    onResourceSelected(rowIndex, columnIndex);
  }

  /*
   * One of the link types was clicked, get the object values of the
   * link and send them to the parent so they can be rendered in
   * another ResourcesColumn.
   */
  handleLinkSelected(event) {
    let { onLinkTypeSelected, rowIndex, columnIndex } = this.props;
    let objectURIs = this.resource.get(event.target.attributes.link.value);
    onLinkTypeSelected(Array.isArray(objectURIs)?objectURIs: [objectURIs], rowIndex, columnIndex);
  }


  /*
   * Display the resource preview dialog if the space bar was pressed
   */
  handlePreviewSelected(event) {
    if (event.key !== ' ') return;
    const { resource } = this.props;  // this is the Compact representation of the resource
    this.setState({dialog: resource.getSmallPreview(), isOpened: true});
  }

  handlePreviewClosed(event) {
    this.setState({dialog: null, isOpened: false});
  }

  openInEditor(event, data) {
    window.open(data.resource.getURI());
  }

  showPreview(event, data) {
     this.setState({dialog: data.resource.getSmallPreview(), isOpened: true});
  }

  showInExplorer(event, data) {
    let { onShowInExplorer } = this.props;
    onShowInExplorer(data.resource);
  }

  /* render the compact representation of the OSLC resource
   * using the resource preview capability
   */
  render() {
    const { resource, rowIndex, columnIndex } = this.props;

    // choose the best label for understandibility and short length
    let label = undefined;
    if (!label) label = resource.getTitle();
    if (!label) label = resource.getShortTitle();
    if (!label) label = resource.getURI(); // the label of last resort 
    label = entities.decode(label);  // Some dcterms:title properties are HTML encoded
    let menuId = `R${rowIndex}C${columnIndex}`;

    return (
      <div>
        <ContextMenuTrigger id={menuId} holdToDisplay={1000}>
        <Accordion className='resource-item'>
          <AccordionItem 
            title={label} 
            onHeadingClick={this.handleShowLinks} 
            onClick={this.handleResourceSelected}
            onKeyPress={this.handlePreviewSelected}>
            {this.state.items}
          </AccordionItem>    
        </Accordion>
        <PreviewDialog dialog={this.state.dialog} open={this.state.isOpened} onDialogClose={this.handlePreviewClosed}/>
        </ContextMenuTrigger>  
        <ContextMenu id={menuId}>
            <MenuItem onClick={this.openInEditor} data={{ resource: resource }}>Show in editor...</MenuItem>
            <MenuItem onClick={this.showPreview} data={{ resource: resource }}>Show preview...</MenuItem>
            <MenuItem onClick={this.showInExplore} data={{ resource: resource }}>Show in explorer...</MenuItem>
            <MenuItem>Analyze impact...</MenuItem>
            <MenuItem>Delete</MenuItem>
        </ContextMenu>
      </div>   
    )
  }
}

export default ResourceItem;
