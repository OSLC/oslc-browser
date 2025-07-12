
var artifacts = [
];

var links = [
	/.*\/rm\/types\/.*/,		// all DND *_ListType artifact attribute data types
	'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
	'http://open-services.net/ns/core#instanceShape',
	'http://open-services.net/ns/core#serviceProvider',
	'http://open-services.net/ns/config#component',
	/.*project/,
	/.*risk/,
	/.*contributor/,
	/.*accessContext/,
	/.*priority/,
	/.*type/,
	/.*resolvedBy/,
	/.*modifiedBy/,
	/.*creator/,
	/.*severity/,
	/.*accessControl/,
	/.*hasPriority/,
	/.*template/,
	/.*category/,
	/.*category_.*/,
	/.*hasWorkflowState/,
	/.*relation/,
	/.*executionInstructions/
];


class Filter {

	static filterArtifact(artifactType) {
		for(let artifact of artifacts) {
			if (artifact === artifactType || artifact.test(artifactType)) return true;
		}
		return false;
	}

	static filterLink(linkType) {
		for(let link of links) {
			if (link === linkType || (link instanceof RegExp && link.test(linkType))) return true;
		}
		return false;
	}
}

export default Filter;

