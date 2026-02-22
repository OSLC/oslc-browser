import React, { Component } from 'react';
import PropTypes from 'prop-types';
import async from 'async';
import ResourcesColumn from '../../ResourcesColumn';

import './ColumnsView.css';

/*
 * A ColumnsView renders a list of ResourcesColumns, each of which renders a list
 * of ResourceItems. Columns and added and removed from the right-most column based on
 * the OSLC resource and link type property selected.
 * The state of this ColumnsView is an array of an array of OSLC Compact resources, each of which
 * is displayed in a separate column.
 */
class ColumnsView extends Component {
  static propTypes = {
    resource: PropTypes.object, // the resource OSLC Compact resource representation
    server: PropTypes.object, // An OSLCServer to use to access resources
  };

  static defaultProps = {
    resource: [[null]],
    server: null,
  };

  constructor(props) {
    super(props);
    // State is an array of an array of Compact resource representations, one for each column
    this.state = { data: [[null]] };
    this.handleLinkTypeSelected = this.handleLinkTypeSelected.bind(this);
    this.handleResourceSelected = this.handleResourceSelected.bind(this);
  }

  /*
     * A Link type was selected and objectURIs is an array of the object URI values
     * of the link type. Get the Compact representations of these resources and
     * render them in a new column to the right
     */
  handleLinkTypeSelected(objectURIs, rowIndex, columnIndex) {
    const { server } = this.props;
    const previews = [];
    // try to get the Compact representation, but if the resource doesn't
    // support OSLC resource preview, just get the resource
    const options = {
      uri: null,
      headers: {
        Accept:
        'application/x-oslc-compact+xml;q=0.5,application/rdf+xml;q=0.4',
        'OSLC-Core-Version': '2.0',
      },
    };

    async.forEach(
      objectURIs,
      (objectURI, callback) => {
        options.uri = objectURI;
        server.read(options, (err, resource) => {
          if (!err) {
            previews.push(resource);
            return callback();
          }
          console.log(
            `Could not read resource ${objectURI}, status: ${err}`,
          );
          return callback();
        });
      },
      // Passes in the error, if there is one.
      (err) => {
        if (err) {
          return console.log(err);
        }
        return this.setState((state) => {
          const data = state.data.slice(0, columnIndex + 1);
          data.push(previews);
          return {
            data,
          };
        });
      },
    );
  }

  handleResourceSelected(rowIndex, columnIndex) {
    this.setState(state => ({
      data: state.data.slice(0, columnIndex + 1),
    }));
  }

  render() {
    // state passed from containing component
    const { resource, server } = this.props;
    const { data } = this.state;

    // did the resource change? If so, start over with a new first left column
    if (resource && resource !== data[0][0]) {
      this.setState({ data: [[resource]] }); // one column with one resource
      return null;
    }

    if (!data[0][0]) return null; // no data yet

    const columns = data.map((resources, index) => (
      <ResourcesColumn
        resources={resources}
        columnIndex={index}
        key={index}
        server={server}
        onResourceSelected={this.handleResourceSelected}
        onLinkTypeSelected={this.handleLinkTypeSelected}
      />
    ));

    return <div className="columns-view">{columns}</div>;
  }
}

export default ColumnsView;
