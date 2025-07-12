import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ToolBar from './ToolBar';
import Favorites from './Favorites';
import IconView from './IconView';
import ListView from './ListView';
import ColumnsView from './ColumnsView';
import ResourceGraph from './ResourceGraph';
import OSLCClient from './OSLCClient';

/*
 * ResourceNavigator renders the OSLC resource from the ToolBar
 * address field
 */
class ResourceNavigator extends Component {
  static propTypes = {
    resource: PropTypes.string // URI of an OSLC resource
  }

  static defaultProps = {
    resource: null
  }

  constructor(props) {
    super(props);
    this.state = {
      resource: null,
      explorerResource: null
    }
    this.server = new OSLCClient(undefined, 'devonce','devonce');
    this.handleResourceURIChanged = this.handleResourceURIChanged.bind(this);
    this.showInExplorer = this.showInExplorer.bind(this);
  }

  /*
   * A new resource URI was entered into the ToolBar address field.
   * Start a the navigator off on this single root resource. It will be
   * in the left-most, single ResourcesColumn in the ColumnsView
   */
  handleResourceURIChanged(resourceURI) {
    var self = this;
    let options = {
      uri: resourceURI,
      headers: {
        'Accept': 'application/x-oslc-compact+xml;q=0.5,application/rdf+xml;q=0.4',
        'OSLC-Core-Version': '2.0'
      }
    };

    this.server.read(options, function(err, resource) {
        if (err) {
          console.log(`Could not read resource ${resourceURI}, status: ${err}`);
        } else {
          self.setState({resource: resource});
        }
    });
  }

  showInExplorer(resource) {
    this.setState({explorerResource: resource});
  }


  render() {
    return (
      <div className='resource-navigator'>
        <ToolBar 
          onResourceURIChanged={this.handleResourceURIChanged}
        />
        <div className='content'>
          <Favorites className='favorites' onNavigateResource={this.handleResourceURIChanged}/>
          <ColumnsView className='columns-view' root={this.state.resource} server={this.server} />
       </div>
       <ResourceGraph className='graph' resource={this.state.resource} server={this.server} onShowInExplorer={this.showInExplorer} />
      </div>
    )
  }
}

export default ResourceNavigator;
