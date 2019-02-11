import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import "../node_modules/carbon-components/css/carbon-components.css";
import ResourceNavigator from './ResourceNavigator.js';

class App extends Component {
  render() {
    return (
      <div className="App">
        <title>OSLC Browser</title>
        <header >
          <h5>OSLC Browser</h5>
        </header>
        <ResourceNavigator resource='' />
      </div>
    );
  }
}

export default App;
