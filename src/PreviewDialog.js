import React, { Component } from 'react';
import { Modal } from 'carbon-components-react';
import PropTypes from 'prop-types';

const { decode } = require('html-entities');

class PreviewDialog extends Component {

  constructor(props) {
  	super(props);
  	this.handleClose = this.handleClose.bind(this);
  }

  handleClose = () => {
  	this.props.onDialogClose();
  }

  render() {
  	const { dialog, open } = this.props;
  	let document = decode(dialog?dialog.document:'');
    return (
      <Modal open={open} onRequestClose={this.handleClose}>
      	<iframe src={document}></iframe>
      </Modal>
    );
  }
}

export default PreviewDialog;
