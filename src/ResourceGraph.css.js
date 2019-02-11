var styles = [
	{selector: 'node',
		style: {
			'label': 'data(label)',
			'width': 'label',
			'height': 'label',
			'padding': '3',
			'shape': 'roundrectangle',
			'border-width': '2',
			'border-style': 'solid',
			'text-max-width': '140px',
			'text-wrap': 'wrap',
			'background-color': '#cddbf2',
			'font-size': '14pt',
			'text-halign': 'center',
			'text-valign': 'center'
		}
	},

	{selector: 'edge',
		style: {
			'label': 'data(label)',
			'target-arrow-shape': 'vee',
			'font-size': '12pt'
		}
	},

  {selector: 'node.highlight',
    style: {
        'border-color': '#FFF',
        'border-width': '2px'
  	},
	},
	{selector: 'node.semitransp',
	    style:{ 'opacity': '0.5' }
	},
	{selector: 'edge.highlight',
	    style: { 'mid-target-arrow-color': '#FFF' }
	},
	{selector: 'edge.semitransp',
	    style:{ 'opacity': '0.2' }
	}
];

export default styles;

