import { TableContainer, TableRow, TableCell, TableBody, Typography } from "@mui/material";
import { ReactElement } from "react";

export interface Property {
    name: string;
    value: string|number|ReactElement;
}

interface Props {
    properties?: Property[];
    loading: boolean;
}

const PropertiesCard = (props: Props) => {
    const { properties, loading } = props;
    if(!properties || properties.length == 0 && !loading) {
        return <Typography variant="body1">No metadata available.</Typography>
    }
    return (
        <TableContainer>
            <TableBody>
                {properties.map((property) => (
                    <TableRow>
                        <TableCell component="th" scope="row">{property.name}</TableCell>
                        <TableCell>{property.value}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </TableContainer>
    );
}

export default PropertiesCard;