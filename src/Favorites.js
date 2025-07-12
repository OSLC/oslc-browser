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
          nodeLabel='RefImpl'
          collapsed={self.state.collapsed}
          onClick={self.expandFolder.bind(null, 1)}>
          	{/* <div href='https://cm.refimpl.oslc.ldsw.eu/services/change_request/d1922b2f-d56a-4fa1-b26b-ec7d4cfb7224'
          		onClick={self.navigateResource}
          		>Change request 84</div> */}
          	<div href='https://rm.refimpl.oslc.ldsw.eu/services/Requirement/sp_single/req_1'
          		onClick={self.navigateResource}
          		>Requirement SP_SINGLE-R1</div>
        </TreeView>
      </div>      
    )
  }
}

export default Favorites;
