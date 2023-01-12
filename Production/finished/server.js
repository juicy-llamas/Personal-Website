
const fs = require( 'fs' );
const http = require( 'http' );
const https = require( 'https' );

let do_https = true;
const do_https_action = ( f ) => {
	if ( do_https === true ) {
		try {
			return f();
		} catch ( e ) {
			console.error( e );
			console.warn( '!!!WARNING!!! Not using HTTPS' );
			do_https = false;
			return null;
		}
	}
}

const pkey = do_https_action( () => fs.readFileSync( 'cert/private.key', 'utf8' ) );
const cert = do_https_action( () => fs.readFileSync( 'cert/certificate.crt', 'utf8' ) );

const express = require( 'express' );
const app = express();
const port = process.argv[ 2 ] || 80;
const https_port = process.argv[ 3 ] || 443;

app.use( '/', express.static( 'static' ) );

// can remove if not windows
{
	const os = require( 'os' );
	if ( os.version().includes( 'dows' ) )
		app.use( '/Assets', express.static( 'Assets' ) );
}

const http_s = http.createServer( app );
const https_s = do_https_action( () => https.createServer( { key: pkey, cert: cert }, app ) );

const start_fn = ( e, m ) => {
	if ( e !== undefined )
		console.error( `An error ${m}occurred: ${e}` );
	else
		console.log( 'Server ' + m + 'started...' );
}

http_s.listen( port, ( e ) => start_fn( e, '' ) );
if ( do_https === true ) https_s.listen( https_port, ( e ) => start_fn( e, '(https) ' ) );
