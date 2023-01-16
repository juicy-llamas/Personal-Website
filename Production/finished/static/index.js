
/*
 * Landing graphical interface / control script.
 *
 * (c) Daniel Moylan 2021
 */

"use strict";

{
	function perror ( e ) {
		console.error( e );
		const t = document.createElement( 'p' );
		document.getElementsByClassName( 'content' )[ 0 ].remove();
		t.innerHTML = e + "<br />:(";
		t.style.margin = '24px';
		document.body.append( t );
		gg = 1;
	}
	try {
		eval( '"use strict"; let foo = () => true;' );
	} catch {
		perror( 'Your browser doesn\'t support ES6' );
		throw new Error( 'ES6 is required' );
	}
}

Math.clamp = ( e, g, l ) => e > g ? g : ( e < l ? l : e );

const _tfind = ( t, f ) => {
	for ( let i = 0; i < t.length; i++ ) {
		const res = f( t.item( i ), i );
		if ( res ) return t.item( i );
	}
	return undefined;
}
const _tany = ( t, f ) => {
	for ( let i = 0; i < t.length; i++ ) {
		const res = f( t.item( i ), i );
		if ( res ) return true;
	}
	return false;
}

//Need to execute this on the window load, so it's in a function.
const fn = async function () {
//	Getting variables. For now it's webgl2, but honestly I don't need webgl2, so I might just revert it to webgl1.
	const canvas = document.getElementById( "screen" );
	const gl = canvas.getContext( 'webgl2' );
	const image = document.getElementById( "image" );
	const isundef = ( elm ) => elm === undefined || elm === null;	

//	chrome warning; need to put here b.c. 
//	also mobile instructions for use
	{
		let chromeWarning = document.getElementById( 'chrome-notice' );
		let isMobile = window.navigator.userAgent.toLowerCase();
		isMobile = isMobile.indexOf( 'mobile' ) >= 0 ||
				   isMobile.indexOf( 'phone' ) >= 0 ||
				   isMobile.indexOf( 'ios' ) >= 0 ||
				   isMobile.indexOf( 'andrioid' ) >= 0;
		let isChrome = ( window.chrome !== undefined && window.chrome !== null ) || 
						window.navigator.userAgent.indexOf( 'Chrome' ) !== -1;
		if ( isMobile ) chromeWarning.innerHTML = 'Brush or drag your finger across the screen.' + ( !isChrome ? ' ' + chromeWarning.innerHTML : '' );
		if ( isChrome && !isMobile ) chromeWarning.style.display = 'none';
	}

	{
		const perror = ( e ) => {
			console.error( e );
			const t = document.createElement( 'p' );
			document.getElementsByClassName( 'content' )[ 0 ].remove();
			t.innerHTML = e + "<br \\>:(";
			t.style.margin = '24px';
			document.body.append( t );
			throw new Error( 'Something went wrong--see page' );
		};
		if ( isundef( canvas ) ) perror( "Your browser does not support canvas." );
		if ( isundef( gl ) || isundef( gl.viewport ) ) perror( "Your browser does not suppport WebGL2 (WebGL1 won't work)." );
		if ( isundef( image ) ) perror( "Problem loading image." );
	}

	const glErrStr = ( num ) => {
		switch ( num ) {
			case gl.NO_ERROR:
				return "WebGL: NO_ERROR (were you expecting one?)";
			case gl.INVALID_ENUM:
				return "WebGL: INVALID_ENUM";
			case gl.INVALID_VALUE:
				return "WebGL: INVALID_VALUE";
			case gl.INVALID_OPERATION:
				return "WebGL: INVALID_OPERATION";
			case gl.INVALID_FRAMEBUFFER_OPERATION:
				return "WebGL: INVALID_FRAMEBUFFER_OPERATION";
			case gl.OUT_OF_MEMORY:
				return "WebGL: OUT_OF_MEMORY";
			case gl.CONTEXT_LOST_WEBGL:
				return "WebGL: CONTEXT_LOST_WEBGL";
			default:
				return ("WebGL threw an undefined error!");
		}
	}
	gl.getErrorStr = () => glErrStr( gl.getError() );

//	initial resize before we do anything
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;
	
	let cw = canvas.width / 2;
	let ch = canvas.height / 2;
	
//	global mouse coord and timing variables.
	let tPrev = 0;
	let tDelta = 0;
	let mx = -1;
	let my = -1;
	let currentPointer = null;

//	To hold the requestAnimationFrame so we can stop it.
	let animFrame = null;
	
//	This resizes the gl viewport, sets the color to all zeros (white), and enables blending so we can use opacity in an intuitive sense.
	gl.viewport( 0, 0, canvas.width, canvas.height );
	gl.clearColor( 0.0, 0.0, 0.0, 0.0 );
	gl.clearDepth( 1.0 );//				Clear everything
	gl.enable( gl.BLEND );//				Enable bLENDING
	gl.disable( gl.DEPTH_TEST );
	gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

//	Simple helper function to compiler a shader.
	const compile_shader = ( src, type ) => {
		const ret = gl.createShader( type );
		gl.shaderSource( ret, src );
		gl.compileShader( ret );

		// return ret;
		if ( gl.getShaderParameter( ret, gl.COMPILE_STATUS ) )
			return ret;
		else {
			// The error message outputs the type of shader or undefined, this works for my purposes even though I miss others like the geometry shader.
			const typStr = type === gl.VERTEX_SHADER ? "vertex shader" : ( type === gl.FRAGMENT_SHADER ?
					"fragment shader" : "undefined shader" );
			console.error( "a(n) " + typStr + " shader did not compile: " + gl.getShaderInfoLog( ret ) );
		}
	};
	
//	Simple helper function to compiler a program.
	const create_program = ( vss, fss ) => {
		const ret = gl.createProgram();
		
//		calls compile_shader for the two shaders
		{
			const vs = compile_shader( vss, gl.VERTEX_SHADER );
			const fs = compile_shader( fss, gl.FRAGMENT_SHADER );

			gl.attachShader( ret, vs );
			gl.attachShader( ret, fs ); 
		}
		
		gl.linkProgram( ret );
		return ret;
//		if ( gl.getProgramParameter( ret, gl.LINK_STATUS ) )
//			return ret;
//		else
//			console.error( "a program did not link: " + gl.getProgramInfoLog( ret ) );
	};
	
//	The first framebuffer stores the circles which are then rendered on the background.
//	The second framebuffer then store the rendered image and does postprocessing effects on it,
//	but I haven't gotten to that yet.
	const fbs = {
		"fb1" : gl.createFramebuffer(),
		"tx1" : gl.createTexture(),
		"fb2" : gl.createFramebuffer(),
		"tx2" : gl.createTexture()
	};
	
//	Set up for the framebuffers
	const size_fbs = () => {
//		Create texture 1
		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, fbs.tx1 );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
//		Linear is the best filter
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
//		Bind texture to fb1
		gl.bindFramebuffer( gl.FRAMEBUFFER, fbs.fb1 );
		gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbs.tx1, 0 );
//		Create texture 2
		gl.activeTexture( gl.TEXTURE2 );
		gl.bindTexture( gl.TEXTURE_2D, fbs.tx2 );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
//		Bind texture to fb2
		gl.bindFramebuffer( gl.FRAMEBUFFER, fbs.fb2 );
		gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbs.tx2, 0 );
	}

	const circles = new ( function () {

//		When true, means we have clicked on a circle link and thus 'selected' that circle, so we are out of nav mode. This disables things like circles.mousemove and circles.reset.
		let SELECTED_STATE = false;

//		Vertex shader
		const vs = `
			attribute float vertexNum;
			
			#define TUPI radians( 360. )
			
			attribute vec2 Acenter;
			attribute vec2 AR;
			attribute float Aang1;
			attribute float Aang2;
			attribute vec4 Acolor;
			
			varying vec2 Vcenter;
			varying vec2 VR;
			varying float Vang1;
			varying float Vang2;
			varying vec4 Vcolor;
			varying float delta;
			
			uniform vec2 Uresolution;
			
			void main () {
				vec2 mask = vec2( sign( ( vertexNum - 1.5 ) / 2.0 ), sign( ( mod( vertexNum, 2.0 ) - 0.5 ) ) );
				vec2 cen = ( Acenter - Uresolution / 2. );
				float scaling = 1. + 2.0 / ( 1. + pow( 1.005, max( min( Uresolution.x - 100., Uresolution.y - 100. ), 0. ) ) );
				vec2 pos = ( AR.x * scaling * mask + cen ) / Uresolution * 2.;

				gl_Position = vec4( pos, 0., 1. );
				
				Vcenter = Acenter;
				VR = AR;
				Vang1 = Aang1;
				Vang2 = Aang2;
				Vcolor = Acolor;
			}
		`;
		
		const fs = `
// 			#ifdef GL_OES_standard_derivatives
// 			#extension GL_OES_standard_derivatives : enable
// 			#endif

			#define PI radians( 180. )
			#define TUPI radians( 360. )

			#ifdef GL_FRAGMENT_PRECISION_HIGH
				precision highp float;
			#else
				precision mediump float;
			#endif

			varying vec2 Vcenter;
			varying vec2 VR;
			varying float Vang1;
			varying float Vang2;
			varying vec4 Vcolor;

			void main () {
				vec2 diff = gl_FragCoord.xy - Vcenter;
				float alpha = 0.;
//				There was an issue with the squares overflowing the float val, so I had to change to highp.
// 				But, highp is not universally supported, so I can fall back to mediump 
				#ifndef GL_FRAGMENT_PRECISION_HIGH
					vec2 R2 = VR;
					vec2 dist = vec2( dot( diff / VR.x, diff ), dot( diff / VR.y, diff ) );
				#else
					vec2 R2 = VR * VR;
					float dotp = dot( diff, diff );
					vec2 dist = vec2( dotp, dotp );
				#endif
				
// 				#ifdef GL_OES_standard_derivatives
// 				float delta = abs( dFdx( dist ) ) + abs( dFdy( dist ) );
// 				delta = delta < 1. ? 1. : delta;
// 				#else
				float delta = 2. * VR.x;
// 				#endif

//				With the altdelta was too big, so I 4th rooted it.
				#ifndef GL_FRAGMENT_PRECISION_HIGH
					delta = pow( delta, 1./4. );
				#endif

//				Fixed hole-in-the-circle problem, may make this better later.
				if ( dist.x < R2.x - delta && R2.y == 0. ) {
					alpha = 1.;
				} else {
					/*
						CHANGE THIS WAY OF DOING THINGS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 
						YOU CAN DO THIS WITH MATRIX MATH.
					*/
					float theta = atan( -diff.y, -diff.x ) + PI;

					float deltaT = 0.010;
					alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist.x )
								- smoothstep( R2.y + delta, R2.y - delta, dist.y );

					if ( Vang2 < TUPI ) {
						if ( Vang2 > Vang1 ) {
							alpha = alpha - smoothstep( Vang1 + deltaT, Vang1 - deltaT, theta )
										  - smoothstep( Vang2 - deltaT, Vang2 + deltaT, theta );
						} else {
							if ( theta > Vang2 + deltaT ) {
								alpha = alpha - smoothstep( Vang1 + deltaT, Vang1 - deltaT, theta );
							} else {
								alpha = alpha - smoothstep( Vang2 - deltaT, Vang2 + deltaT, theta );
							}
						}
					}
					
					alpha = clamp( alpha, 0., 1. );

					// if ( alpha == 0. )
					// 	discard;
				}
				
				gl_FragColor = vec4( Vcolor.rgb, Vcolor.a * alpha );
			}
		`;

//		Create program from shaders
		const program = create_program( vs, fs );
		gl.useProgram( program );
		
		const vertexNum = gl.getAttribLocation( program, "vertexNum" );
		
		const Acenter = gl.getAttribLocation( program, "Acenter" );
		const AR = gl.getAttribLocation( program, "AR" );
		const Aang1 = gl.getAttribLocation( program, "Aang1" );
		const Aang2 = gl.getAttribLocation( program, "Aang2" );
		const Acolor = gl.getAttribLocation( program, "Acolor" );
		
		const Uresolution = gl.getUniformLocation( program, "Uresolution" );
		
		gl.uniform2f( Uresolution, canvas.width, canvas.height );
		
		const vertexBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ 0, 1, 2, 3 ] ), gl.STATIC_DRAW );

//		Number of circles on screen
		const NUM_OF_CIRCLES = 6;
		
//		Defines spin rates (resting is initial, when you first move your mouse over a circle it speeds up to spinny, and when it hits SPINNY_SPIN_RATE - SPIN_TOLERANCE or above, it drops down to OVER_SPIN_RATE.
		const RESTING_SPIN_RATE = .2;
		const SPINNY_SPIN_RATE = 8;
		const OVER_SPIN_RATE = 0;
		const SPIN_TOLERANCE = 0.01;
		
//		Elements per circle of WebGL buffer array (circleData)
		const CIRC_SIZE = 10;
//		Elements per circle of general circle bookeeping array (this.circles)
		const CIRCLES_SIZE = 9;
//		The sum of these should be below 1.
		const INNER_RAD = 0.66;
		const OUTER_RAD = 0.086;

//		Array that gets fed to GL shaders
		let circleData = [];
//		Bookeeping array that contains calculation information we need
		this.circles = [];
//		
		
		const colorCenter = [ 0.745, 0.960, 0.976, 0.8 ];
		const colorSides = [ 0.745, 0.960, 0.976, 0.8 ];

		const createCircle = ( cx, cy, r, spin, angle_offset, number ) => {
//			Push the various attributes to the array.
			this.circles.push( cx );
			this.circles.push( cy );
			this.circles.push( spin );
			this.circles.push( r );
			this.circles.push( r );//	r goal radius
			this.circles.push( 0 );//	r'
			this.circles.push( spin );//	spin goal
			this.circles.push( false );//	is this circle zeroed?

//			Text associated with circle.
			const text = document.getElementById( "circ" + number );
			this.circles.push( text );
			text.style.left = (cx - text.clientWidth / 2) + 'px';
			text.style.top = (canvas.height - cy - text.clientHeight / 2) + 'px';

			let ang1 = angle_offset + Math.PI > Math.PI * 2 ? angle_offset - Math.PI : angle_offset + Math.PI;
			let ang2 = angle_offset + Math.PI * 1.7 > Math.PI * 2 ? angle_offset - Math.PI * 0.3 : angle_offset + Math.PI * 1.7;
			let ang3 = angle_offset + Math.PI * 0.7 > Math.PI * 2 ? angle_offset - Math.PI * 1.3 : angle_offset + Math.PI * 0.7;
			
//			Assign initial parameters. This is necessary since I don't set the color anywhere else.
			circleData = [ ...circleData,
				cx, cy, r * INNER_RAD, 0, 0, 2. * Math.PI + 0.001 , ...colorCenter,
				cx, cy, r, r * (1-OUTER_RAD), ang1, ang2, ...colorSides,
				cx, cy, r, r * (1-OUTER_RAD), angle_offset, ang3, ...colorSides,
			];
		};

		let k = 0;
		const updateCircle/*s?*/ = ( index, canvas_width_p_canvas_height ) => {
//			Every element of the circle array listed out by name.
			const cx = this.circles[ index * CIRCLES_SIZE + 0 ];
			const cy = this.circles[ index * CIRCLES_SIZE + 1 ];
			let spin = this.circles[ index * CIRCLES_SIZE + 2 ];
			let r = this.circles[ index * CIRCLES_SIZE + 3 ];
			let r_goal = this.circles[ index * CIRCLES_SIZE + 4 ];
			let r_p = this.circles[ index * CIRCLES_SIZE + 5 ];
			let spin_goal = this.circles[ index * CIRCLES_SIZE + 6 ];
			const zeroed = this.circles[ index * CIRCLES_SIZE + 7 ];

//			This is to hopefully prevent gridlocked cases (sometimes the outer rings are solid or the circles are blown up).
			r_goal = r_goal === Infinity || r_goal === NaN ? REST_R : r_goal;
			spin_goal = spin_goal === Infinity || spin_goal === NaN ? RESTING_SPIN_RATE : spin_goal;
			spin = spin === Infinity || spin === NaN ? RESTING_SPIN_RATE : spin;
			r_p = r_p === Infinity || r_p === NaN ? 0 : r_p;
			r = r === Infinity || r === NaN ? REST_R : r;
			r = r > canvas_width_p_canvas_height ? canvas_width_p_canvas_height : r;
			spin = spin > SPINNY_SPIN_RATE * 2 ? SPINNY_SPIN_RATE : spin;
			spin_goal = spin_goal > SPINNY_SPIN_RATE * 2 ? SPINNY_SPIN_RATE : spin_goal;

//			Spring equation for radius.
			const k_r = 0.022;
			const diff = r_goal - r;
//			I wanted the circles to be springy with low values, but not so springy that they will fall into themselves with high values. 
//			I also wanted them to expand and contract quickly though. Hence, this weird experimentally derived equation.
			const damp = Math.clamp( 1 + Math.abs( diff ) * 0.0124 - 0.24 * Math.max( Math.abs( r_p ) - 0.36, 0 ) , 0.986, 0.02 );
			const r_pp = k_r * diff;
			r_p = r_p * damp + r_pp * tDelta;//Math.clamp( r_p * damp + r_pp * tDelta, 2.4, -2.4 );
			r = r + r_p * tDelta;

// 			if ( index === 2 && k >= 128 ) {
// 				console.log( `td = ${tDelta}` );
// 				k = 0;
// 			}
// 			k += 1;

//			If the radius is set to zero, it will go to zero and then come back and oscillate for a while due to the spring equation.
//			The 'zeroed' variable makes sure that if the radius is set to zero when naving, it does not bounce up (I just thought that looked really weird and didn't much care for it).
			if ( zeroed === true && r <= 0 ) {
				r_p = 0;
				r = 0;
			}
			
//			Spring equation for spin, looks large because of the state bookeeping but it's really not.
			let k_spin = 0.05;
			switch ( spin_goal ) {
				case RESTING_SPIN_RATE:
					k_spin = 0.04;
					break;
				case SPINNY_SPIN_RATE:
					k_spin = .108;
					break;
				case OVER_SPIN_RATE:
					k_spin = 0.04;
					break;
			}
			const spin_p = k_spin * ( spin_goal - spin );
//			if ( spin_goal === OVER_SPIN_RATE )
//				spin = spin + spin_p * spin_p * tDelta;
//			else
				spin = spin + spin_p * tDelta;
			if ( spin >= spin_goal - SPIN_TOLERANCE && spin_goal === SPINNY_SPIN_RATE ) {
				spin_goal = OVER_SPIN_RATE;
			}
			
//			Loading in all data for circles (yes, we have to do cx and cy because they can change on resize).
			circleData[ index * CIRC_SIZE * 3 + 0 ] = cx;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE ] = cx;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 ] = cx;
			circleData[ index * CIRC_SIZE * 3 + 1 ] = cy;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE + 1 ] = cy;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 + 1 ] = cy;
			circleData[ index * CIRC_SIZE * 3 + 2 ] = r * INNER_RAD;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE + 2 ] = r;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE + 3 ] = r * (1-OUTER_RAD);
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 + 2 ] = r;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 + 3 ] = r * (1-OUTER_RAD);
			
//			Updating changed circle parameters.
			this.circles[ index * CIRCLES_SIZE + 5 ] = r_p;
			this.circles[ index * CIRCLES_SIZE + 3 ] = r;
			this.circles[ index * CIRCLES_SIZE + 2 ] = spin;
			this.circles[ index * CIRCLES_SIZE + 6 ] = spin_goal;

//			These are the individual angles for the spinny arcs.
			let one = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 4 ];
			let two = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 5 ];
			let thr = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 4 ];
			let fou = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 5 ];
// 			Same deal...
			one = one === Infinity || one === NaN ? 0 : one;
			two = two === Infinity || two === NaN ? Math.PI * 0.7 : two;
			thr = thr === Infinity || thr === NaN ? Math.PI : thr;
			fou = fou === Infinity || fou === NaN ? Math.PI * 1.7 : fou;
//			Spin rate is in radians per sec, and we approximate that by accounting for passed time and converting to ms.
			const rate = spin * tDelta / (125 / 3);

//			We load the angles into the array such that they don't go past 2 * Math.PI.
			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 4 ] = one + rate >= 2 * Math.PI ? one + rate - 2 * Math.PI : one + rate;
			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 5 ] = two + rate >= 2 * Math.PI ? two + rate - 2 * Math.PI : two + rate;
			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 4 ] = thr + rate >= 2 * Math.PI ? thr + rate - 2 * Math.PI : thr + rate;
			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 5 ] = fou + rate >= 2 * Math.PI ? fou + rate - 2 * Math.PI : fou + rate;
		};

//		I'm not sure if the circles will be usable on a smaller screen, so I leave this warning.
		if ( canvas.width < 1920 / 2 || canvas.height < 1080 / 2 )
			console.warn( "To developer: Rendering circles on small a screen--are you sure you want to do this?" );
		
//		These dictate the placing, distance between, and radius of the circles in resting and expanded states.
//		They change with a screen resize.
		let REST_R = 0;
		let EXP_R = 0;
		let PAD = 0;
		let PADW = 0;
		let DIST = 0;

		const get_head = () => {
			const note = document.getElementById( 'chrome-notice' );
			const wgl = document.getElementById( 'webgl-lost-notice' );
			const head = document.getElementsByClassName( 'site-header' )[ 0 ];
			const note_head = note.style.display === 'none' ? 0 : note.clientHeight + 64;
			const wgl_head = wgl.style.display !== 'block' ? 0 : wgl.clientHeight;
			const site_head = head.clientHeight;
			return ( canvas.width > 1024 ? Math.max( note_head, site_head ) : ( note_head + site_head ) ) + wgl_head;
		};

		const set_r_consts = () => {
			const canvas_height = canvas.height - get_head();
			const mx = Math.max( canvas.width, canvas_height );
			const mn = Math.min( canvas.width, canvas_height );
			REST_R = Math.sqrt( mx * mn / ( NUM_OF_CIRCLES * NUM_OF_CIRCLES ) / 2 );
//			console.log( "=============================" );
//			console.log( canvas.width );
//			console.log( canvas.height );
//			console.log( mx*mx/mn/ NUM_OF_CIRCLES/ NUM_OF_CIRCLES * 0.5 );
//			console.log( mn * 0.36 );
//			console.log( REST_R );
//			console.log( "=============================" );
			EXP_R = REST_R * 1.1;
			PAD = EXP_R * 1.9;
			PADW = EXP_R * 1.4;
			DIST = PAD * 1.3;

			document.querySelector( ':root' ).style.setProperty( '--crc-txt-sz', ( REST_R * 2 ) + 'px' );
		}
		set_r_consts();

//		This places the circles initially
//		Put in a function to benchmark it.
		const gen_circles = ( max_gens ) => {
			let best_config = [];
			let best_error = 50000001;
			this.circles = [];

			const canvas_height = canvas.height - get_head();
//			center of screen
			const cenx = cw;
			const cenh = canvas_height / 2;

			for ( let l = 0; l < max_gens; l++ ) {
				let this_config = [];
				let this_error = 0;
				let xOrig = 0;
				let yOrig = 0;
				let angAdd = 0;

//				Initialize the first circle at one of the 'walls'
				if ( canvas.width < canvas.height ) {
					xOrig = Math.random() * ( canvas.width - 2 * PADW ) + PADW;

					let k = Math.random();
					yOrig = k > 0.5 ? PADW : canvas_height - PADW;
//					aim at center of screen
//					angAdd = k > 0.5 ? 0 : Math.PI;
				} else {
					yOrig = Math.random() * ( canvas_height - 2 * PADW ) + PADW;

					let k = Math.random();
					xOrig = k > 0.5 ? PADW : canvas.width - PADW;
//					angAdd = k > 0.5 ? 3 * Math.PI / 2 : Math.PI / 2;
				}

				this_config[ 0 ] = xOrig;
				this_config[ 1 ] = yOrig;

				for ( let i = 1; i < NUM_OF_CIRCLES; i++ ) {

//					randomly choose an angle for circle
					let theta = Math.random() * 2 * Math.PI;
					let rdist = 0;
					let cx = this_config[ 2*i - 2 ] + DIST * Math.cos( theta );
					let cy = this_config[ 2*i - 1 ] + DIST * Math.sin( theta );

					let bestx = cx;
					let besty = cy;
					let bestError = 50000000 / NUM_OF_CIRCLES; //a big number

					const check = () => {
						const plusx = ( x ) => x > 0 ? x : 0;
						let error = plusx( PADW - cx ) + plusx( cx - ( canvas.width - PADW ) ) + plusx( PADW - cy ) + plusx( cy - ( canvas_height - PADW ) );
						error *= 2 * error;

						for ( let j = 0; j <= i; j++ ) {
							let x = cx - this_config[ j * 2 ];
							let y = cy - this_config[ j * 2 + 1 ];
							let squ = x * x + y * y;
							error += plusx( PAD * PAD - squ );
						}

//						console.log( `x: ${cx}, y: ${cy}, e: ${error}` );

						if ( error > 0 ) {
							if ( error < bestError ) {
								bestx = cx;
								besty = cy;
								bestError = error;
							}
							return true;
						} else
							return false;
					};

					const max_atts = 36;
					let limit = max_atts;
					while ( check() && limit > 0 ) {
						theta = Math.random() * 2 * Math.PI;
						rdist = DIST * ( 0.8 + 0.2 * Math.random() );
						cx = this_config[ 2*i - 2 ] + rdist * Math.cos( theta );
						cy = this_config[ 2*i - 1 ] + rdist * Math.sin( theta );
						limit -= 1;
					}

					if ( check() ) {
						cx = bestx;
						cy = besty;
					}

//					put the data in for the circle
					this_config[ i*2 ] = cx;
					this_config[ i*2 + 1 ] = cy;
					this_error += bestError;
				}

				if ( this_error < best_error ) {
					best_error = this_error;
					best_config = this_config;
					console.log( 'best_err: ' + best_error );
				}
			}

			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				let angle_offset = Math.random() * Math.PI * 2;
// 				console.log( i );
// 				console.log( best_config[ i*2 ] );
// 				console.log( best_config[ i*2 + 1 ] );
				createCircle( best_config[ i*2 ], best_config[ i*2 + 1 ], REST_R, RESTING_SPIN_RATE, angle_offset, i + 1 );
			}
		};
		gen_circles( 32 );

		const fix_circles = ( step_amt, w_ratio, h_ratio ) => {;
			const canvas_height = canvas.height - get_head();
			const plusx = ( x ) => ( x > 0 ) * x;
			const products = [];
			let step_size = 1 / 4;

			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				this.circles[ i * CIRCLES_SIZE + 0 ] *= w_ratio;
				this.circles[ i * CIRCLES_SIZE + 1 ] *= h_ratio;
			}

			for ( let iter = 0; iter < step_amt; iter++ ) {
				for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
					products[ i * 2 + 0 ] = 0;
					products[ i * 2 + 1 ] = 0;

					const cx = this.circles[ i * CIRCLES_SIZE + 0 ];
					const cy = this.circles[ i * CIRCLES_SIZE + 1 ];

					const lp = ( j ) => {
						const x = cx - this.circles[ j * CIRCLES_SIZE + 0 ];
						const y = cy - this.circles[ j * CIRCLES_SIZE + 1 ];
						const squ = x * x + y * y;

						if ( squ < DIST * PAD ) {
							products[ i * 2 + 0 ] += x;
							products[ i * 2 + 1 ] += y;
						}
					};
					for ( let j = 0; j < i; j++ ) lp( j );
					for ( let j = i + 1; j < NUM_OF_CIRCLES; j++ ) lp( j );

					products[ i * 2 + 0 ] += 2 * ( plusx( PADW - cx ) - plusx( cx - ( canvas.width - PADW ) ) );
					products[ i * 2 + 1 ] += 2 * ( plusx( PADW - cy ) - plusx( cy - ( canvas_height - PADW ) ) );

					this.circles[ i * CIRCLES_SIZE + 0 ] += products[ i * 2 + 0 ] * step_size;
					this.circles[ i * CIRCLES_SIZE + 1 ] += products[ i * 2 + 1 ] * step_size;
				}
				step_size /= 1.02;
			}

			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
//				Also change the text position
				const text = this.circles[ i * CIRCLES_SIZE + 8 ];
				text.style.left = (this.circles[ i * CIRCLES_SIZE + 0 ] - text.clientWidth / 2) + 'px';
				text.style.top = (canvas.height - this.circles[ i * CIRCLES_SIZE + 1 ] - text.clientHeight / 2) + 'px';
			}
		};
		
		const arcBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( circleData ), gl.STATIC_DRAW );
		
//		Webgl rendering stuff
		const render = () => {
//			Enable all vertex attribs to start (the ones we need)
			gl.enableVertexAttribArray( vertexNum );
			gl.enableVertexAttribArray( Acenter );
			gl.enableVertexAttribArray( AR );
			gl.enableVertexAttribArray( Aang1 );
			gl.enableVertexAttribArray( Aang2 );
			gl.enableVertexAttribArray( Acolor );
		
//			Load data into the buffers.
			gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer )
			gl.vertexAttribPointer( vertexNum, 1, gl.FLOAT, false, 0, 0 );
			
			gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
			gl.vertexAttribPointer( Acenter, 2, gl.FLOAT, false, 10 * 4, 0 );
			gl.vertexAttribPointer( AR, 2, gl.FLOAT, false, 10 * 4, 2 * 4 );
			gl.vertexAttribPointer( Aang1, 1, gl.FLOAT, false, 10 * 4, 4 * 4 );
			gl.vertexAttribPointer( Aang2, 1, gl.FLOAT, false, 10 * 4, 5 * 4 );
			gl.vertexAttribPointer( Acolor, 4, gl.FLOAT, false, 10 * 4, 6 * 4 );
			
//			(important) Lets GL know that these attribs apply once per *instance*, instance being a circle.
//			Note that vertexNum is not specified since it is defined once per *point*
			gl.vertexAttribDivisor( Acenter, 1 );
			gl.vertexAttribDivisor( AR, 1 );
			gl.vertexAttribDivisor( Aang1, 1 );
			gl.vertexAttribDivisor( Aang2, 1 );
			gl.vertexAttribDivisor( Acolor, 1 );
			
//			Output to a framebuffer so that we can do more rendering
			gl.bindFramebuffer( gl.FRAMEBUFFER, fbs.fb1 );
			
//			Draws 3 * NUM_OF_CIRCLES *instances*, each instance having 4 vertices (they're squares)
			gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, 4, 3 * NUM_OF_CIRCLES );

//			We set the framebuffer to null by default, which is the canvas.
			gl.bindFramebuffer( gl.FRAMEBUFFER, null );
			
//			We disable the vertex attrib arrays. If a program requires less vertex attribs in the future, we can't have more enabled.
			gl.disableVertexAttribArray( vertexNum );
			gl.disableVertexAttribArray( Acenter );
			gl.disableVertexAttribArray( AR );
			gl.disableVertexAttribArray( Aang1 );
			gl.disableVertexAttribArray( Aang2 );
			gl.disableVertexAttribArray( Acolor );
		};
		
//		Update function -- gets called by animate
		this.update = () => {
//			We use this program.
			gl.useProgram( program );
			
//			Update circle array (do math calculations) for each circle.
			const k = ( canvas.width + canvas.height );
			for ( var i = 0; i < NUM_OF_CIRCLES; i++ ) {
				updateCircle( i, k );
			}

//			Write the changes to the GL buffer
			gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
			let eeee = new Float32Array( circleData );
			gl.bufferSubData( gl.ARRAY_BUFFER, 0, eeee, 0, Math.round( NUM_OF_CIRCLES * 3 * CIRC_SIZE ) );

//			Render the scene to the framebuffer.
			render();
		};

//		This controls the circle mouse over effect.
		this.mousemove = ( mouse_x, mouse_y ) => {
//			Don't process event in selected state
			if ( SELECTED_STATE === false ) {
				for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
					const cx = this.circles[ i * CIRCLES_SIZE + 0 ];
					const cy = this.circles[ i * CIRCLES_SIZE + 1 ];
					const r = this.circles[ i * CIRCLES_SIZE + 3 ];

					const adj_x = mouse_x - cx;
					const adj_y = mouse_y - cy;

//					Basically, if the mouse is found within the radius of any of the circles...
					if ( adj_x * adj_x + adj_y * adj_y <= r * r ) {
//						Then set our goal r to EXP_R...
						this.circles[ i * CIRCLES_SIZE + 4 ] = EXP_R;
//						and we set the spin goal to spinny if it is not already at the over rate.
						if ( this.circles[ i * CIRCLES_SIZE + 6 ] != OVER_SPIN_RATE )
							this.circles[ i * CIRCLES_SIZE + 6 ] = SPINNY_SPIN_RATE;
					} else {
//						Otherwise, we set the goals to resting values.
						this.circles[ i * CIRCLES_SIZE + 4 ] = REST_R;
						this.circles[ i * CIRCLES_SIZE + 6 ] = RESTING_SPIN_RATE;
					}
				}
			}
		};

		let res_timeout = false;
//		Updates the circles when the screen resizes.
		this.resize = ( ow, oh, precision = 10 ) => {
//			First set the program and change our uniform for resolution.
			gl.useProgram( program );
			gl.uniform2f( Uresolution, canvas.width, canvas.height );
			
//			Next, reset the values for r and the pad / distance (though reseting the pad and distance is not really necessary, I do it anyways in case I do anything more with them in the future).
			set_r_consts();
			
//			Manually trigger the mouse move event so we can update all of the circles' radii.
			this.mousemove( ( mx + 1 ) * cw, - ( my - 1 ) * ch );

//			Then we grow/shrink the circle center coordinates porportionally to the amount the screen did.
			const w_ratio = canvas.width / ow;
			const h_ratio = canvas.height / oh;

			clearTimeout( res_timeout );
			res_timeout = setTimeout( () => fix_circles( precision, w_ratio, h_ratio ), 40 );
		};

//		Sets the circles' r and spin to their original defaults.
		this.reset = ( pageLeave ) => {
			console.log( 'reset' );
//			If we are normally navving, keep all circles at rest on nav away.
			if ( SELECTED_STATE === false ) {
				for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
//					Set r_goal and spin_goal to start.
					this.circles[ i * CIRCLES_SIZE + 4 ] = REST_R;
					this.circles[ i * CIRCLES_SIZE + 6 ] = RESTING_SPIN_RATE;
					this.circles[ i * CIRCLES_SIZE + 7 ] = false;
//					Set r and spin to goal and r' to zero. This will stop any current motion and is used when leaving the page.
					if ( pageLeave === true ) {
						this.circles[ i * CIRCLES_SIZE + 5 ] = 0;
						this.circles[ i * CIRCLES_SIZE + 2 ] = RESTING_SPIN_RATE;
						this.circles[ i * CIRCLES_SIZE + 3 ] = REST_R;
					}
				}
//			If we aren't in nav mode, only keep the big displayed circle at rest.
			} else {
				this.circles[ SELECTED_STATE * CIRCLES_SIZE + 3 ] = this.circles[ SELECTED_STATE * CIRCLES_SIZE + 4 ];
				this.circles[ SELECTED_STATE * CIRCLES_SIZE + 5 ] = 0;
			}
		};

//		Focuses on one circle (specifically the circle at the offset 'index'.
		const select = ( index ) => {
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				const cx = this.circles[ i * CIRCLES_SIZE + 0 ];
				const cy = this.circles[ i * CIRCLES_SIZE + 1 ];
//				If it's the focus circle...
				if ( i === index ) {
//					We want the circles to shrink before we expand the big circle.
					setTimeout( () => {
//						Get the radius the circle should be and set it.
						const max_x = canvas.width + Math.abs( cx - cw );
						const max_y = canvas.height + Math.abs( cy - ch );
						this.circles[ i * CIRCLES_SIZE + 4 ] = 1.1 * Math.sqrt( max_x * max_x + max_y * max_y );
//						Why not?
						this.circles[ i * CIRCLES_SIZE + 6 ] = 0;
					}, 500 );
				} else {
//					We still want a delay to wait for the text to fade out.
					setTimeout( () => {
//						Otherwise, zero the radius / spin and set the circle as 'zeroed' (see updateCircle).
						this.circles[ i * CIRCLES_SIZE + 4 ] = 0;
						this.circles[ i * CIRCLES_SIZE + 6 ] = 0;
						this.circles[ i * CIRCLES_SIZE + 7 ] = true;
					}, 200 );
				}
			}

//			Disable mouse movement
			SELECTED_STATE = index;
		};

//		Click event for circles.
		this.click = ( mouse_x, mouse_y ) => {
//			SELECTED_STATE should not be true if this function is called.
			if ( SELECTED_STATE !== false ) {
				console.error( "circles.click should not be called when a circle is already selected." );
			}

			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				const cx = this.circles[ i * CIRCLES_SIZE + 0 ];
				const cy = this.circles[ i * CIRCLES_SIZE + 1 ];
				const r = this.circles[ i * CIRCLES_SIZE + 3 ];

				const adj_x = mouse_x - cx;
				const adj_y = mouse_y - cy;

//				If the pointer is in the radius of a circle
				if ( adj_x * adj_x + adj_y * adj_y <= r * r ) {
//					Then do the navigation animation and return the index of the clicked circle.
					select( i );
					return i;
				}
			}
//			-1 means no clicked circles.
			return -1;
		};

//		Resets the nav.
		this.deselect = ( i ) => {
			this.circles[ i * CIRCLES_SIZE + 4 ] = REST_R;
			this.circles[ i * CIRCLES_SIZE + 6 ] = RESTING_SPIN_RATE;
			this.circles[ i * CIRCLES_SIZE + 7 ] = false;
			setTimeout( () => {
				SELECTED_STATE = false;
				this.mousemove( ( mx + 1 ) * cw, - ( my - 1 ) * ch );
			}, 600 );
		};
	} )();

	const bkgd = new ( function () {
		const vs = `
			attribute vec2 Apos;
			attribute vec2 AtexBk;
			varying vec2 VtexBk;
			attribute vec2 AtexFg;
			varying vec2 VtexFg;

			void main() {
				gl_Position = vec4( Apos, 0., 1. );
				VtexBk = AtexBk;
				VtexFg = AtexFg;
			}
		`;

		const fs = `
			precision mediump float;
			uniform sampler2D UtexBk;
			varying vec2 VtexBk;
			uniform sampler2D UtexFg;
			varying vec2 VtexFg;

			vec4 accurate_mix ( vec4 bk, vec4 fg ) {
				float alpha = 1.0 - fg.a;

//				Gamma correction of 2, close enough to 2.2 or whatever the ideal ratio is.
				vec3 color = sqrt( fg.rgb * fg.rgb + bk.rgb * bk.rgb * alpha );

				float out_alpha = fg.a + bk.a * alpha;
				return vec4( color, out_alpha );
			}

			void main() {
				vec4 final_color = accurate_mix( texture2D( UtexBk, VtexBk ), texture2D( UtexFg, VtexFg ) );
				gl_FragColor = vec4( final_color.rgb, 1.0 );
			}
		`;

		const program = create_program( vs, fs );
		gl.useProgram( program );

		const Apos = gl.getAttribLocation( program, "Apos" );
		const Abk = gl.getAttribLocation( program, "AtexBk" );
		const Ubk = gl.getUniformLocation( program, "UtexBk" );
		const Afg = gl.getAttribLocation( program, "AtexFg" );
		const Ufg = gl.getUniformLocation( program, "UtexFg" );

		gl.uniform1i( Ubk, 1 );

		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, fbs.tx1 );
		gl.uniform1i( Ufg, 0 );

//				Resolution of the image
		let res_x, res_y, scale_x, scale_y;

//		~~Not really the center, but a point we will center our calculations for the texture coords around.~~
//		Yes, the actual center, because contrast..
		const center_x = .5;//1 - 1275 / 5160;
		const center_y = .5;//1 - 1419 / 2871;
//		Percentage of the shown image to parallax scroll
		const extra_scale = 0.1;

		let bk_arr = [];
		const bk_buf = gl.createBuffer();

//		call w/ await
		this.finishInitTexture = async function () {
			gl.activeTexture( gl.TEXTURE1 );
			const tex_bk = gl.createTexture();

			gl.bindTexture( gl.TEXTURE_2D, tex_bk );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
			gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
			gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image );

			let err = null;
			let i = 0;
			let factor = 1;
			while ( ( err = gl.getError() ) !== gl.NO_ERROR ) {
				console.warn( glErrStr( err ) );
//				android was giving an error cause the texture was too big
//				this reduces the size of the texture (hopefully)
				const res_canv = document.createElement( "canvas" );
				const res_ctx = res_canv.getContext( "2d" );

				res_canv.width = image.width >> 1;
				res_canv.height = image.height >> 1;
				console.log( 'w: ' + image.width + ', rw: ' + res_canv.width + ', rh: ' + res_canv.height );
				res_ctx.drawImage( image, 0, 0, res_canv.width, res_canv.height );

				const dataURI = res_canv.toDataURL();
				image.src = dataURI;
				const promise = () => new Promise( res => {
					image.onload = () => {
						gl.bindTexture( gl.TEXTURE_2D, tex_bk );
						gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image );
						console.log( 'w: ' + image.width + ', h: ' + image.height );
						res();
					}
				} );
				await promise();
				factor *= 2;
				if ( i++ > 256 ) {
					break;
				}
			}

//					Resolution of the image
			res_x = image.width * 0.5 * factor;
			res_y = image.height * 0.5 * factor;

			scale_x = Math.min( 1, 2 * canvas.width / res_x );
			scale_y = Math.min( 1, 2 * canvas.height / res_y );

// 			console.log( 'scalex: ' + scale_x + ', scaley: ' + scale_y );

			{
				const l_s = center_x * ( 1 - scale_x ) + extra_scale * scale_x;
				const b_s = center_y * ( 1 - scale_y ) + extra_scale * scale_y;
				const r_s = l_s + scale_x - 2 * extra_scale * scale_x;
				const t_s = b_s + scale_y - 2 * extra_scale * scale_y;

				bk_arr = new Float32Array( [
					r_s, t_s,
					r_s, b_s,
					l_s, t_s,
					l_s, b_s,
				] );
			}

			gl.bindBuffer( gl.ARRAY_BUFFER, bk_buf );
			gl.bufferData( gl.ARRAY_BUFFER, bk_arr, gl.STATIC_DRAW );
		}

		const pos_buf = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, pos_buf );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ -1, -1,
															-1,  1,
															1, -1,
															1,  1 ] ), gl.DYNAMIC_DRAW );

		const fg_buf = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, fg_buf );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ 0, 0,
															0, 1,
															1, 0,
															1, 1 ] ), gl.STATIC_DRAW );

		const render = () => {
			gl.enableVertexAttribArray( Apos );
			gl.enableVertexAttribArray( Abk );
			gl.enableVertexAttribArray( Afg );

			gl.bindBuffer( gl.ARRAY_BUFFER, pos_buf );
			gl.vertexAttribPointer( Apos, 2, gl.FLOAT, false, 0, 0 );

			gl.bindBuffer( gl.ARRAY_BUFFER, bk_buf );
			gl.vertexAttribPointer( Abk, 2, gl.FLOAT, false, 0, 0 );

			gl.bindBuffer( gl.ARRAY_BUFFER, fg_buf );
			gl.vertexAttribPointer( Afg, 2, gl.FLOAT, false, 0, 0 );

			gl.vertexAttribDivisor( Apos, 0 );
			gl.vertexAttribDivisor( Abk, 0 );
			gl.vertexAttribDivisor( Afg, 0 );

			gl.bindFramebuffer( gl.FRAMEBUFFER, null );

			gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

			gl.disableVertexAttribArray( Apos );
			gl.disableVertexAttribArray( Abk );
			gl.disableVertexAttribArray( Afg );
		};

		const addToBkBuff = () => {
			const new_arr = bk_arr.map( ( elm, ind ) => { return elm + ( ind % 2 === 0 ? this.x : this.y ) } );
			gl.bindBuffer( gl.ARRAY_BUFFER, bk_buf );
			gl.bufferSubData( gl.ARRAY_BUFFER, 0, new_arr, 0, 8 );
		};

		const v_mult = 0.0008;
		this.x = 0;
		this.y = 0;

		this.update = () => {
			gl.useProgram( program );

			let velx = v_mult * ( mx - this.x / extra_scale / scale_x );
			let vely = v_mult * ( my - this.y / extra_scale / scale_y );

			this.x += velx * tDelta;
			this.y += vely * tDelta;

			addToBkBuff();
			render();
		};

		this.resize = () => {
			scale_x = Math.min( 1, 2 * canvas.width / res_x );
			scale_y = Math.min( 1, 2 * canvas.height / res_y );

			{
				const l_s = center_x * ( 1 - scale_x ) + extra_scale * scale_x;
				const b_s = center_y * ( 1 - scale_y ) + extra_scale * scale_y;
				const r_s = l_s + scale_x - 2 * extra_scale * scale_x;
				const t_s = b_s + scale_y - 2 * extra_scale * scale_y;

				bk_arr = new Float32Array( [
					r_s, t_s,
					r_s, b_s,
					l_s, t_s,
					l_s, b_s,
				] );
			}

			gl.bindBuffer( gl.ARRAY_BUFFER, bk_buf );
			gl.bufferData( gl.ARRAY_BUFFER, bk_arr, gl.STATIC_DRAW );
		};

		this.reset = () => {
			this.x = 0;
			this.y = 0;
		};

	} )();

//	Control logic for the back arrow and it's animations.
	const arrow = new ( function () {
//		Opacity binds for back arrow.
		const OPACITY_REST = 0.6;
		const OPACITY_OVER = 1;
//		An array of arrays of elements that form 'pages'.
//		When we click on a circle (one of the five, right now), we will display and fade in all of the elements in the array.
//		When we click on the back arrow, we will fade out all of them, and then set them to 'display:none;' with a setTimeout call.
		const DOCUMENTS = document.getElementsByClassName( "page" );
//		Arrow object (is constant for every document)
		const arrow_obj = document.getElementById( "back-arrow" );

		const hide_objs = document.getElementsByClassName( 'disappear-on-focus' );

//		Chosen document
		let chosen_one = null;
		let last_index = -1;
		let chosen_timeout = null;
//		Opacity variables for arrow object (yes it has it's own spring).
		let current_opacity = 0;
		let opacity_pp = 0;
		let opacity_p = 0;
		let goal_opacity = 0;
//		There was a bug with the setTimeout on the arrow, this should fix it
		let arrow_timeout = undefined;

//		This function turns off the display and resets the circles.
		const mouseclick = () => {
//			Fade out content and back arrow, then remove it from display
			arrow_obj.onpointerover = undefined;
			arrow_obj.onpointerout = undefined;
			arrow_obj.onclick = undefined;
			goal_opacity = 0;
//			Note that we put all of the timeouts into a
//			1000 here is an arbitrary amount of time so I can tell how long the animation will take to complete.
			arrow_timeout = setTimeout( () => { arrow_obj.style.display = 'none'; this.update = () => {}; }, 500 );

			chosen_one.classList.add( 'fade-out' );
			chosen_one.classList.remove( 'fade-in' );
//			The animation *should* takes 400 ms to complete, so I add an extra 50 ms just to be sure the function is called when it's completed.
			chosen_timeout = setTimeout( () => {
				chosen_one.style.display = 'none';
				for ( const e of hide_objs ) {
					e.classList.add( 'fade-in' );
					e.classList.remove( 'fade-out' );
					e.style.display = 'block';
				}
				setTimeout( () => circles.resize( canvas.width, canvas.height ), 2 );
			}, 450 );

//			restore circles and click event
			circles.deselect( last_index );
			canvas.onclick = click_select;

			window.onhashchange = undefined;
		};

//		When the user hovers over the arrow, it should increase in opacity.
		const mouseover = () => { goal_opacity = OPACITY_OVER; };
		const mouseout = () => { goal_opacity = OPACITY_REST; };

//		This function shows the back arrow, sets up it's animations and events, and then shows the rest of the document that's selected.
		this.show = ( THE_CHOSEN_DOCUMENT ) => {
			if ( THE_CHOSEN_DOCUMENT !== -1 ) {
//				If we have a timeout set to remove the arrow, disable it immediately...
				clearTimeout( arrow_timeout );
//				Same goes for the elements (if we clicked off an element and then really quickly clicked back on it again for some reason...)
//				But ONLY if the elements are the same ones we clicked off of last time, if they are different we do want them to disappear.
				if ( last_index === THE_CHOSEN_DOCUMENT )
					clearTimeout( chosen_timeout );

//				Set up the back arrow
				arrow_obj.style.display = 'block';
				arrow_obj.onpointerover = mouseover;
				arrow_obj.onpointerout = mouseout;
				arrow_obj.onclick = mouseclick;
				this.update = live_update;
				goal_opacity = OPACITY_REST;

//				Show the chosen document.
				chosen_one = DOCUMENTS[ THE_CHOSEN_DOCUMENT ]; //That's a mouthful...
				last_index = THE_CHOSEN_DOCUMENT;
				chosen_timeout = null;
//				fade it in
				chosen_one.style.display = 'block';
				chosen_one.classList.add( 'fade-in' );
				chosen_one.classList.remove( 'fade-out' );

				window.location.href = '#pg';
				setTimeout( () => { window.onhashchange = mouseclick; }, 200 );
			}
		};

		const live_update = () => {
			const k = 0.024;
			const damp = 0.08;
			opacity_pp = k * ( goal_opacity - current_opacity );
			opacity_p = opacity_p + opacity_pp * tDelta - opacity_p * damp;
			current_opacity = current_opacity + opacity_p * tDelta;

			arrow_obj.style.opacity = current_opacity;
		};

		this.update = () => {};

		this.reset = () => {
			goal_opacity = OPACITY_REST;
			current_opacity = OPACITY_REST;
			opacity_p = 0;
			opacity_pp = 0;
		}
	} )();

//	let ctr = 0;
	const animate = ( tNow ) => {
		tDelta = tNow - tPrev;
		tDelta /= 24;
//		if ( ctr === 128 ) {
//			console.log( tDelta );
//			ctr = 0;
//		} else
//			ctr++;

		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		gl.bindFramebuffer( gl.FRAMEBUFFER, fbs.fb1 );
		gl.clear( gl.COLOR_BUFFER_BIT );
		gl.bindFramebuffer( gl.FRAMEBUFFER, fbs.fb2 );
		gl.clear( gl.COLOR_BUFFER_BIT );

		circles.update();
		bkgd.update();
		arrow.update();

		window.ontouchmove = touchmove;
		window.onmousemove = mousemove;
		animFrame = requestAnimationFrame( animate );
		tPrev = tNow;
	};

	/*
	 * Events
	 */

//	Resize resizes the canvas and GL buffer, along with calling various functions for resizing the different components.
	const resize = () => {
		const canvw = canvas.width;
		const canvh = canvas.height;

		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		cw = canvas.width / 2;
		ch = canvas.height / 2;

		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		gl.viewport( 0, 0, canvas.width, canvas.height );
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

		size_fbs();

		circles.resize( canvw, canvh );
		bkgd.resize();
	};

	const touchmove = ( e ) => {
		console.log( 'touchmove: ' );
		let elm;
		if ( e.targetTouches && !( elm = _tfind( e.targetTouches, ( i ) => i.identifier === currentPointer ) ) ) {
			return;
		}
		window.ontouchmove = null;
		mousemove( elm );
	}

	const mousemove = ( e ) => {
		window.onmousemove = null;
		mx = e.clientX / cw - 1;
		my = -e.clientY / ch + 1;

		circles.mousemove( e.clientX, canvas.height - e.clientY );
	};

	const mouseout = ( e ) => {
		e.preventDefault();
		console.log( 'mouseout: ' );
		let ind;
		if ( e.targetTouches && !( ind = _tfind( e.targetTouches, ( i ) => i.identifier === currentPointer ) ) )
			return;

		mx = 0;
		my = 0;
		window.onpointermove = null;
		currentPointer = null;
	};

	const leavepage = ( e ) => {
		cancelAnimationFrame( animFrame );
		mouseout( e );
		currentPointer = null;
		mx = 0;
		my = 0;
		bkgd.reset();
		arrow.reset();
		circles.reset( true );
	};

//	When a circle is clicked
	const click_select = ( e ) => {
		const nav_to = circles.click( e.clientX, canvas.height - e.clientY );
		setTimeout( () => {
			arrow.show( nav_to );
		}, 800 );

		console.log( nav_to );
		if ( nav_to !== -1 ) {
//			Fade out site title.
			const hide_objs = document.getElementsByClassName( 'disappear-on-focus' );
			for ( let i = 0; i < hide_objs.length; i++ ) {
				let e = hide_objs[ i ];
				e.classList.add( 'fade-out' );
				e.classList.remove( 'fade-in' );
				setTimeout( () => { e.style.display = 'none'; }, 450 );
			}
			canvas.onclick = undefined;
		}
	};

	/*
	 * Main
	 */

//	assign bkgd texture
	await bkgd.finishInitTexture();

//	Do a resize to sync everything (technically undoes some init work but whatever)
	resize();
// 	circles.resize( canvas.width, canvas.height, 38 );

//	assign events
	window.onresize = resize;
	if ( screen && screen.orientation ) screen.orientation.onchange = ( e ) => { resize(); e.stopPropagation(); };
	window.onorientationchange = ( e ) => { resize(); e.stopPropagation(); };
// 	window.onbeforeunload = leavepage;
	window.onpagehide = leavepage;
	const vs_ch = ( e ) => { if ( document.visibilityState === 'hidden' ) leavepage( e ); else animFrame = requestAnimationFrame( animate ); };
	window.addEventListener( 'visibilitychange', vs_ch );
	canvas.onclick = click_select;
	window.onmouseleave = mouseout;
	window.onmouseout = mouseout;
	window.ontouchstart = ( e ) => {
		console.log( 'touchstart: ' );
		if ( currentPointer === null && e.touches && e.touches.length > 0 )
			currentPointer = e.touches[ 0 ].identifier;
	};
	window.ontouchend = ( e ) => {
		console.log( 'touchend: ' );
		if ( !( e.targetTouches ) || _tany( e.targetTouches, ( i ) => i.identifier === currentPointer ) )
			currentPointer = null;
	};
	window.ontouchcancel = ( e ) => { canvas.ontouchend( e ); mouseout( e ); };

// 	specific bug w firefox
	canvas.addEventListener( 'webglcontextlost', () => {
		console.warn( 'deleting WEBGL context...' );
		cancelAnimationFrame( animFrame );

		// 		reset events
		window.onpagehide = undefined;
		window.removeEventListener( 'visibilitychange', vs_ch );
		canvas.onclick = undefined;
		window.onmousemove = undefined;
		window.ontouchmove = undefined;
		window.onmouseleave = undefined;
		window.onmouseout = undefined;
		window.ontouchstart = undefined;
		window.ontouchend = undefined;
		window.ontouchcancel = undefined;

// 		fade out everything
		const content = document.getElementsByClassName( 'content' ).item( 0 );
		content.classList.remove( 'fade-in' );
		content.classList.add( 'fade-out' );

// 		add a new canvas
		setTimeout( () => {
			let clone = document.createElement( 'canvas' );
			canvas.remove();
			clone.id = 'screen';
			let bcanv = document.getElementsByClassName( 'before-canvas' ).item( 0 );
			content.insertBefore( clone, bcanv );

			document.getElementById( 'webgl-lost-notice' ).style.display = 'block';

//	 		reset everything after fade out
			console.warn( 'restarting WEBGL context...' );
			setTimeout( fn, 40 );
		}, 310 );
	} );

//	Finally, when we're all done initializing the page, THEN we fade in so it doesn't look choppy.
	setTimeout( () => {
		const content = document.getElementsByClassName( "content" )[ 0 ]
		content.classList.remove( "fade-out" );
		content.classList.add( "fade-in" );
	}, 80 );

	tPrev = performance.now();
	animFrame = requestAnimationFrame( animate );
};

window.onload = fn;
