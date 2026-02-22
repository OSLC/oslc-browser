import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ListGroup } from 'react-bootstrap';

import './Sidebar.css';

class Sidebar extends Component {
  static propTypes = {
    // resource: PropTypes.object, // URI of an OSLC resource
    onNavigateResource: PropTypes.func.isRequired,
  }

  // static defaultProps = {
  //   resource: null,
  // }

  constructor(props) {
    super(props);
    this.state = { collapsed: true };

    this.expandFolder = this.expandFolder.bind(this);
    this.navigateResource = this.navigateResource.bind(this);
  }

  expandFolder = () => {
    this.setState(state => ({ collapsed: !state.collapsed }));
  }

  navigateResource = (event) => {
    const { onNavigateResource } = this.props;
    onNavigateResource(event.target.getAttribute('href'));
  }

  render() {
    return (
      <div className="sidebar">
        <ListGroup>
          <ListGroup.Item
            href="https://ce4iot.rtp.raleigh.ibm.com:9443/rm/resources/_612J0EdcEemyHLQKTjyF3g"
            onClick={this.navigateResource}
          >
            Program to demonstrate oslc-browser
          </ListGroup.Item>
          <ListGroup.Item
            href="https://ce4iot.rtp.raleigh.ibm.com:9443/rm/resources/_60xLwEdcEemyHLQKTjyF3g"
            onClick={this.navigateResource}
          >
            Paper Mail Request Requirement
          </ListGroup.Item>
          <ListGroup.Item
            href="https://elmdemo.smartfacts.com:9443/rm/resources/TX_gLR3UBSnEfCQ7eullXDrzg"
            onClick={this.navigateResource}
          >
            Dividend Allocation Task
          </ListGroup.Item>
        </ListGroup>
      </div>
      // <div className="favorites">
      //   <TreeView
      //     key={1}
      //     nodeLabel="JKE Banking"
      //     collapsed={this.state.collapsed}
      //     onClick={this.expandFolder}
      //   >
      //     <div
      //       href="https://ce4iot.rtp.raleigh.ibm.com:9443/ccm/resource/itemName/com.ibm.team.workitem.WorkItem/84"
      //       onClick={this.navigateResource}
      //     >
      //       Change request 84
      //     </div>
      //     <div
      //       href="https://ce4iot.rtp.raleigh.ibm.com:9443/ccm/resource/itemName/com.ibm.team.workitem.WorkItem/81"
      //       onClick={this.navigateResource}
      //     >
      //       Change request 81
      //     </div>
      //   </TreeView>
      // </div>
    );
  }
}

export default Sidebar;
