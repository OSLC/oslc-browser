import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ResourceItem from './ResourceItem';

/*
 * A ResourcesColumn renders a list of OSLC Compact resources. The state of this
 * ResourcesColumn is an array of an array of OSLC Compact resources, each of which
 * is displayed in a separate column.
 */
class ResourcesColumn extends Component {
  static propTypes = {
    resources: PropTypes.array, // An array of OSLC Compact resources
    server: PropTypes.object,    // An OSLCServer to use to access resources
    columnIndex: PropTypes.number, // column number from the left
    onLinkTypeSelected: PropTypes.func
  }

  static defaultProps = {
    resources: null,
    server: null
  }

  constructor(props) {
    super(props);
  }


  render() {
    // state passed from containing component
    const { resources, server, onLinkTypeSelected, onResourceSelected, columnIndex } = this.props;
    let items = resources.map((resource, index) => {
        return (<ResourceItem 
          resource={resource} 
          columnIndex={columnIndex} rowIndex={index} key={index} 
          server={server} 
          onResourceSelected={onResourceSelected}
          onLinkTypeSelected={onLinkTypeSelected}
        />);
    });
    
    return (
      <div className='resources-column'>
        {items}
      </div>      
    )
  }
}

export default ResourcesColumn;
