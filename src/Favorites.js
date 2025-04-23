import React, { Component } from 'react';
import PropTypes from 'prop-types';
import TreeView from 'react-treeview';
import 'react-treeview/react-treeview.css';

class Favorites extends Component {
  static propTypes = {
    resource: PropTypes.string // URI of an OSLC resource
  }

  static defaultProps = {
    resource: null
  }

  constructor(props) {
    super(props);
    this.state = {collapsed: true}

    this.expandFolder = this.expandFolder.bind(this);
    this.navigateResource = this.navigateResource.bind(this);
  }

  expandFolder(event) {
  	let collapsed = !this.state.collapsed;
  	this.setState({collapsed: collapsed});
  }

  navigateResource(event) {
    const { onNavigateResource } = this.props;
  	onNavigateResource(event.target.getAttribute('href'));
  }

  render() {
  	const self = this;

    return (
      <div className='favorites'>
        <TreeView
          key={1}
          nodeLabel='JKE Banking'
          collapsed={self.state.collapsed}
          onClick={self.expandFolder.bind(null, 1)}>
          	<div href='https://ce4iot.rtp.raleigh.ibm.com:9443/ccm/resource/itemName/com.ibm.team.workitem.WorkItem/84'
          		onClick={self.navigateResource}
          		>Change request 84</div>
          	<div href='https://elmdemo.smartfacts.com:9443/rm/resources/TX_gLR3UBSnEfCQ7eullXDrzg'
          		onClick={self.navigateResource}
          		>Test requirement</div>
        </TreeView>
      </div>      
    )
  }
}

export default Favorites;
