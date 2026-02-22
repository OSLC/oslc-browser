import React, { Component } from 'react';
import ListItem from './ListItem';
// import PropTypes from 'prop-types';
// import { Link } from 'carbon-components-react';

export default class TestLink extends Component {
  constructor(props) {
    super(props);
    this.state = {
      highlightedItem: '',
    };
  }

  handleLinkSelected = (event) => {
    console.log(event);
  }

  handleItemClicked = (event) => {
    this.setState({ highlightedItem: event.currentTarget.innerHTML });
  }

  render() {
    const { highlightedItem } = this.state;
    const testListItems = ['test1', 'test2', 'test3'];
    const items = [];
    testListItems.forEach(item => items.push(
      <ListItem
        highlighted={item === highlightedItem}
        handleItemClicked={this.handleItemClicked}
        itemName={item}
      />,
    ));
    return (
      <div>
        {items}
      </div>
    );
  }
}
