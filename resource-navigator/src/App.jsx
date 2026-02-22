import React, { Component } from 'react';
import {
  Button,
  Form,
  FormControl,
  // Nav,
  Navbar,
} from 'react-bootstrap';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import '../node_modules/carbon-components/css/carbon-components.css';

import ResourceNavigator from './components/ResourceNavigator/ResourceNavigator';
import InfoTabs from './components/Tabs/Tabs';

import './App.css';

const OSLCServer = require('oslc-client/server');
/*
 * App renders the OSLC resource from the ToolBar
 * address field
 */

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resource: null,
    };
    this.server = new OSLCServer(undefined, 'devonce', 'devonce');
    this.handleResourceURIChanged = this.handleResourceURIChanged.bind(this);
  }

  /*
   * A new resource URI was entered into the ToolBar address field.
   * Start a the navigator off on this single root resource. It will be
   * in the left-most, single ResourcesColumn in the ColumnsView
   */
  handleResourceURIChanged(resourceURI) {
    const options = {
      uri: resourceURI,
      headers: {
        Accept: 'application/x-oslc-compact+xml;q=0.5,application/rdf+xml;q=0.4',
        'OSLC-Core-Version': '2.0',
      },
    };

    this.server.read(options, (err, resource) => {
      if (err) {
        console.log(`Could not read resource ${resourceURI}, status: ${err}`);
      } else {
        this.setState({ resource });
      }
    });
  }

  render() {
    return (
      <div className="App">
        <div className="main-content">
          <Navbar bg="primary" variant="dark">
            <Navbar.Brand href="#home">Resource Navigator</Navbar.Brand>
            {/* <Nav className="mr-auto">
              <Nav.Link href="#home">Projects</Nav.Link>
            </Nav> */}
            <Form inline>
              <FormControl
                id="resourceSearch"
                type="text"
                placeholder="Enter resource URI or search term"
                className="mr-sm-2"
              />
              {/* May want to use carbon icons https://github.com/ibm/carbon-icons */}
              <Button id="searchButton" variant="outline-info">
                <FontAwesomeIcon icon={faSearch} />
              </Button>
            </Form>
          </Navbar>
          <ResourceNavigator
            resource={this.state.resource}
            server={this.server}
            handleResourceURIChanged={this.handleResourceURIChanged}
          />
          <InfoTabs
            resource={this.state.resource}
            server={this.server}
          />
        </div>
      </div>
    );
  }
}

export default App;
