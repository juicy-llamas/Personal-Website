
const express = require( 'express' );
const app = express();
const Port = process.env.port || 8000;

app.use( '/', express.static( 'static' ) );

app.listen( Port, ( e ) => {
	if ( e !== undefined )
		console.err( `An error occurred: ${e}` );
	else
		console.log( 'Server started...' );
} );
