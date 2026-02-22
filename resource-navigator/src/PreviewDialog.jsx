import React, { Component } from 'react';
import { Modal } from 'carbon-components-react';
import PropTypes from 'prop-types';

const Entities = require('html-entities').XmlEntities;

const entities = new Entities();

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
  	const document = entities.decode(dialog ? dialog.document : '');
    return (
      <Modal open={open} onRequestClose={this.handleClose}>
        <iframe src={document} />
      </Modal>
    );
  }
}

export default PreviewDialog;
