import React, { Component } from 'react';
import PropTypes from 'prop-types';

class IconView extends Component {
	static propTypes = {
		resource: PropTypes.string // URI of an OSLC resource
	}

	static defaultProps = {
		resource: null
	}

	constructor(props) {
		super(props);
	}

	render() {
		return (
			<div className='icon-view'>
			</div>			
		)
	}
}

export default IconView;
