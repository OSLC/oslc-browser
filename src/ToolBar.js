import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './App.css';
import { Button, Search, Toolbar, TextInput } from 'carbon-components-react'


class ToolBar extends Component {
  static propTypes = {
    resource: PropTypes.string // URI of an OSLC resource
  }

  static defaultProps = {
    resource: null
  }

  constructor(props) {
    super(props);
    this.handleResourceURIChange = this.handleResourceURIChange.bind(this);
  }

  handleResourceURIChange(event) {
    // call the callback to send the data to the state owner
     this.props.onResourceURIChanged(event.target.value);
  }

  render() {
    return (
        <Toolbar className='tool-bar'>
          <Button className='left' id='back'>&lt;</Button>
          <Button className='left' id='forward'>&gt;</Button>
          &nbsp;
          <TextInput 
            style={{width:'40%'}} 
          	id='address' 
          	placeholder='resource URI' 
          	onBlur={this.handleResourceURIChange}
          />
          <Search id='search' placeholder='Search'/>
        </Toolbar>
    )
  }
}

export default ToolBar;
