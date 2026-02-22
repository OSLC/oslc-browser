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
    value: PropTypes.string.isRequired,
    handleLinkSelected: PropTypes.func.isRequired,
    link: PropTypes.string.isRequired,
    highlighted: PropTypes.bool.isRequired,
  }

  handleItemClicked = () => {
    this.props.handleLinkSelected(this.props.link);
  }

  render() {
    const { value } = this.props;
    if (this.props.highlighted) {
      return (
        <div>
          <a onClick={this.handleItemClicked} id="highlighted">{value}</a>
        </div>
      );
    }
    return (
      <div>
        <a onClick={this.handleItemClicked}>{value}</a>
      </div>
    );
  }
}
