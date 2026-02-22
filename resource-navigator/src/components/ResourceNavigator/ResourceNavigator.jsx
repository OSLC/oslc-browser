import React, { Component } from 'react';
import PropTypes from 'prop-types';
// import ToolBar from './ToolBar';
import Sidebar from '../Sidebar/Sidebar';
// import IconView from './IconView';
// import ListView from './ListView';
import ColumnsView from '../ColumnsView/ColumnsView';
// import ResourceGraph from './ResourceGraph';

import './ResourceNavigator.css';

class ResourceNavigator extends Component {
  static propTypes = {
    resource: PropTypes.object, // URI of an OSLC resource
    handleResourceURIChanged: PropTypes.func.isRequired,
    server: PropTypes.object.isRequired,
  }

  static defaultProps = {
    resource: null,
  }

  render() {
    return (
      <div className="resource-navigator">
        <Sidebar
          className="favorites"
          onNavigateResource={this.props.handleResourceURIChanged}
        />
        <ColumnsView
          className="columns-view"
          resource={this.props.resource}
          server={this.props.server}
        />
      </div>
    );
  }
}

export default ResourceNavigator;
