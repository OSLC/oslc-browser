# OSLC Resource Browser

## Introduction

OSLC defines a set of standards that enable loosely coupled integration between applications. This allows applications to use creation and selection dialogs to create links between resources managed by different applications, and it provides a standard way for an application to view the properties of resources managed by some other application. 

Although OSLC enables this integration, it can become quite difficult to view federated information across a set of integrated applications as a single system. Navigation often starts at a specific application which provides its own views for displaying and navigating its managed resources, and links to resources managed by other applications. In order to navigate a system of shared information, users have to follow links from one application to another. This can be inconvenient and inefficient as each application opens its own window and may provide a different user experience for viewing and editing related resourcers.

oslc-browser is a React and Carbon Web application that provides a simple means of browsing and navigating resources managed by a set of federated OSLC servers. It allows users to enter a URL of some root resource. The title of that resource is displayed with the ability to expand the resource and see all its available link types. Selecting a link type displays a list of the related resources. Resources can be navigated across any OSLC server, and users are not aware of server boundaries. 

The most generic, and flexible resource browser would simply reflect on the resource instances as they are discovered. This would provide generic navigation of anything, but might not look that pretty because it would be navigating raw app resources, not necessarily what is expected to be viewed by users.

The oslc-browser supports browsing any OSLC or RDF resources with the following functions:
* display the resource’s preview (icon and title) or URI if preview isn’t available
* edit the title (the URI is read only)
* click on the resource to see its properties (including link properties)
* click on the resource disclose triangle to view the resource’s link properties under the resource
* click on a link property to see the target resources in the next pane to the right
* add and remove links with drag and drop, or using OSLC delegated dialogs
* (edit properties would be done through the properties view, not here)
* View resources in a graph and support expanding and contracting nodes to view related nodes

A Resource Explorer view is optimized for quick navigation and exploration of resources. It helps people quickly navigate between requirements, implementing change requests, validating test cases, satisfying design elements, etc. in order to zero in on what the user needs to do. Users can easily view the properties of a resource to see its details by either using resource preview, or pinning a properties view that is sensitive to the selected resource. The columns view of the Resource Explorer focuses on an single navigation thread (from left to right), and optimizes the navigation of that thread.

A Resource Diagram is optimized for understanding complex relationships. It provides a graphic view of related resources that is optimized for understanding relationships and assessing impact of change. 

Although these two views display the same information, they are complimentary because they each are optimized for different purposes. They can be integrated by:
* users can invoke Show in Diagram... or any resources selected in a Resource Explorer - or drag and drop a resource from a Resource Explorer onto an existing diagram
* users can invoke Show in Explorer... on any resource selected in a Resource Diagram. 

## Installation

## Running the oslc-browser

### Using the OSLC Server University Example

Start the Fuseki server
```
cd ~/bin/jena-fuseki1-3.8.0
./fuseki-server --config=../config-univ.ttl
```
Start the LDP server
```
cd ~/Developer/LDP/ldp-app
node app.js
```
Start the OSLC Browser app

Start Chrome web browser with CORS disabled
```
open -n -a Google\ Chrome --args --disable-web-security --user-data-dir
cd ~/Developer/oslc-browser
npm install
npm start
# Say Y to choose a different port
```
App is running on http://localhost:3001/ 


Browse the umaine University in the Resource Naigator: `http://localhost:3000/univ/umaine`

Browse and explore courses, students, and teachers.

### Connecting to jazz apps

Start you browser with CORS checking disabled

Chrome:
```
open -n -a Google\ Chrome --args --disable-web-security --user-data-dir
```
Safari:
* Preferences/Advanced/Show Development menu in menu bar
* Develop/Disable Cross-Origin Restrictions

Login to the CE servers

Open the jazz apps in Chrome in order to login to the IBM Egineering Lifecycle Management (IELM) servers (the resource-navigator doesn't yet handle authentication):


Start the Resource Navigator in SSL mode
```
cd ~/Developer/resource-navigator
HTTPS=true npm start
```
Enter any Work item or requirement URI to browse the Jazz app resources.

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

