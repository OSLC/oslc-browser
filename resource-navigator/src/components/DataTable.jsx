import React from 'react';
import { DataTable } from 'carbon-components-react';

const {
  Table, TableHead, TableHeader, TableBody, TableCell, TableContainer, TableRow,
} = DataTable;

export default class PropertiesTable extends React.Component {
  render() {
    const rows = [
      {
        id: 'r1',
        resourceName: 'Resource 1',
        propertyColor: 'blue',
        propertyNumber: 1,
      },
      {
        id: 'r2',
        resourceName: 'Resource 2',
        propertyColor: 'red',
        propertyNumber: 2,
      },
    ];
    const headers = [
      {
        // key is name of field on row object. header is display name in Table Header.
        key: 'resourceName',
        header: 'Resource Name',
      },
      {
        key: 'propertyColor',
        header: 'Color Property',
      },
      {
        key: 'propertyNumber',
        header: 'Number Property',
      },
    ];

    return (
      <React.Fragment>
        <DataTable
          rows={rows}
          headers={headers}
          render={({ rows, headers, getHeaderProps }) => (
            <TableContainer title="Test Table">
              <Table>
                <TableHead>
                  <TableRow>
                    {headers.map(header => (
                      <TableHeader {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id}>
                      {row.cells.map(cell => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        />
      </React.Fragment>
    );
  }
}
