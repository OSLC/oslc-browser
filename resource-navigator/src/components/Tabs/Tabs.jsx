import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Tab, Tabs } from 'carbon-components-react';
import PropertiesTable from '../DataTable';
import ResourceGraph from '../../ResourceGraph';

export default class InfoTabs extends Component {
  static propTypes = {
    resource: PropTypes.object, // URI of an OSLC resource
    server: PropTypes.object.isRequired,

  }

  static defaultProps = {
    resource: null,
  }

  render() {
    return (
      <Tabs
        className="some-class"
        selected={1}
        // onClick={onClick}
        // onKeyDown={onKeyDown}
        // onSelectionChange={onSelectionChange}
      >
        <Tab label="Resource Graph">
          <div className="some-content">
            <ResourceGraph
              className="graph"
              resource={this.props.resource}
              server={this.props.server}
            />
          </div>
        </Tab>
        <Tab label="Properties Table">
          <div className="some-content"><PropertiesTable /></div>
        </Tab>
        <Tab label="Tab label 4">
          <div className="some-content">Content for fourth tab goes here.</div>
        </Tab>
      </Tabs>
    );
  }
}
