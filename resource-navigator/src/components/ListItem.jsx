import React, { Component } from 'react';
import PropTypes from 'prop-types';

import './ListItem.css';
/*
 * A ResourceItem renders a specific OSLC Compact resource, and
 * if the resource is expanded, it GETs the resource and lists
 * its object properties. Selection on one of these properties
 * results in a new ResourcesColumn on the Compact representation
 * of the related resources.
 */
export default class ListItem extends Component {
  static propTypes = {
    itemName: PropTypes.string.isRequired,
    handleItemClicked: PropTypes.func.isRequired,
    highlighted: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      // highlighted: false,
    };
  }

  render() {
    const { itemName, highlighted, handleItemClicked } = this.props;
    if (highlighted) {
      return (
        <div>
          <div className="highlighted">{itemName}</div>
        </div>
      );
    }
    // const { highlighted } = this.state;
    return (
      <div>
        <div onClick={handleItemClicked}>{itemName}</div>
      </div>
    );
  }
}
