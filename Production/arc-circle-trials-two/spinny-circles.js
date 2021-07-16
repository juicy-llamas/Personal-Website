"use strict";

const fn = () => {
	const canvas = document.getElementById( "screen" );
	const gl = canvas.getContext( 'webgl2' );
	const image = document.getElementById( "image" );
	
	if ( canvas === undefined ) console.err( "Your browser does not support Canvas." );
	if ( gl === undefined ) console.err( "Your browser does not suppport WebGL2 (WebGL1 won't work)." );
	if ( image === undefined ) console.err( "Problem loading image." );

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	
	let cw = canvas.width / 2;
	let ch = canvas.height / 2;
	
	gl.viewport( 0, 0, canvas.width, canvas.height );
	gl.clearColor( 0.1, 0.1, 0.1, 1.0 );
	gl.clearDepth( 1.0 );					// Clear everything
	gl.enable( gl.DEPTH_TEST );				// Enable depth testing
	gl.depthFunc( gl.LEQUAL );				// Near things obscure far things

	const compile_shader = ( src, type ) => {
		let ret = gl.createShader( type );
		gl.shaderSource( ret, src );
		gl.compileShader( ret );

		if ( gl.getShaderParameter( ret, gl.COMPILE_STATUS ) )
			return ret;
		else {
			let typStr = type === gl.VERTEX_SHADER ? "vertex shader" : ( type === gl.FRAGMENT_SHADER ? 
					"fragment shader" : "undefined shader" );
			console.error( "a(n) " + typStr + " shader did not compile: " + gl.getShaderInfoLog( ret ) );
		}
	};
	
	const create_program = ( vss, fss ) => {
		let ret = gl.createProgram();
		
		// calls compile_shader for the two shaders
		{
			let vs = compile_shader( vss, gl.VERTEX_SHADER );
			let fs = compile_shader( fss, gl.FRAGMENT_SHADER );

			gl.attachShader( ret, vs );
			gl.attachShader( ret, fs ); 
		}
		
		gl.linkProgram( ret );
		if ( gl.getProgramParameter( ret, gl.LINK_STATUS ) )
			return ret;
		else
			console.error( "a program did not link: " + gl.getProgramInfoLog( ret ) );
	};
	
	const circles = new ( function () {
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
			
			uniform vec2 Uresolution;
			
			void main () {
				vec2 mask = vec2( sign( ( vertexNum - 1.5 ) / 2.0 ), sign( ( mod( vertexNum, 2.0 ) - 0.5 ) ) );
				vec2 cen = ( Acenter - Uresolution / 2. );
				float scaling = 1.;// + 2. / ( 1. + pow( 1.01, max( min( Uresolution.x - 100., Uresolution.y - 100. ), 0. ) ) );
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
			#ifdef GL_OES_standard_derivatives
			#extension GL_OES_standard_derivatives : enable
			#endif

			#define PI radians( 180. )
			#define TUPI radians( 360. )

			precision mediump float;

			varying vec2 Vcenter;
			varying vec2 VR;
			varying float Vang1;
			varying float Vang2;
			varying vec4 Vcolor;

			void main () {
				vec2 R2 = VR * VR;
				vec2 diff = gl_FragCoord.xy - Vcenter;
				float dist = dot( diff, diff );
				
				/*
					CHANGE THIS WAY OF DOING THINGS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 
					YOU CAN DO THIS WITH MATRIX MATH.
				*/
				float theta = atan( -diff.y, -diff.x ) + PI;
				
				#ifdef GL_OES_standard_derivatives
				float delta = fwidth( dist );
				delta = delta < 1. ? 1. : delta;
				discard;
				#else
				float delta = 2. * VR.x;
				#endif

				float deltaT = 0.015;
				float alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist )
								- smoothstep( R2.y + delta, R2.y - delta, dist );

				if ( Vang2 <= TUPI ) {
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
				
				// Fixed hole-in-the-circle problem, may make this better later.
				if ( dist < R2.x - delta && R2.y == 0. )
					alpha = 1.;
				
				alpha = clamp( alpha, 0., 5. );

				if ( alpha == 0. )
					discard;
				
				// frame buffer???
				vec4 bkgd = vec4( vec3( 0.1 ), 1. );
				gl_FragColor = mix( bkgd, Vcolor, alpha );
// 				gl_FragColor = vec4( vec3( 1.0 ), 1. );
			}
		`;

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
		
		const NUM_OF_CIRCLES = 5;
		const RESTING_SPIN_RATE = .2;
		const CIRC_SIZE = 10;
		
		let circleData = [];
		let circles = [];
		
		const createCircle = ( cx, cy, r, spin_rate, angle_offset ) => {
			circles.push( cx );
			circles.push( cy );
			circles.push( spin_rate );
			circles.push( r );
			let ang1 = angle_offset + Math.PI > Math.PI * 2 ? angle_offset - Math.PI : angle_offset + Math.PI;
			let ang2 = angle_offset + Math.PI * 1.7 > Math.PI * 2 ? angle_offset - Math.PI * 0.3 : angle_offset + Math.PI * 1.7;
			let ang3 = angle_offset + Math.PI * 0.7 > Math.PI * 2 ? angle_offset - Math.PI * 1.3 : angle_offset + Math.PI * 0.7;
			
			circleData = [ ...circleData, 
				cx, cy, r * 0.6, 0, 0, 2. * Math.PI + 0.001 , 0.9, 0.9, 0.9, 1.,
				cx, cy, r, r * 0.9, ang1, ang2, 0, 1., 0., 1.,
				cx, cy, r, r * 0.9, angle_offset, ang3, 0, 1., 0., 1.,
			];
		};
		
// 		createCircle( 300, 300, 100, RESTING_SPIN_RATE, 0 );
// 		createCircle( 600, 300, 100, RESTING_SPIN_RATE, 0 );
// 		createCircle( 600, 600, 100, RESTING_SPIN_RATE, 0 );
// 		createCircle( 300, 600, 100, RESTING_SPIN_RATE, 0 );
// 		createCircle( 900, 300, 100, RESTING_SPIN_RATE, 0 );
		
		if ( canvas.width < 1920 || canvas.height < 1080 )
			console.warn( "Rendering circles on a screen that is sub HD--are you sure you want to do this?" );
		
		// changes with resize
		let REST_R = Math.min( cw, ch ) / NUM_OF_CIRCLES;
		let EXP_R = REST_R * 1.2;
		let PAD = EXP_R + Math.min( cw, ch ) * 0.25;
		let DIST = Math.max( canvas.width, canvas.height ) * 1.1 / ( NUM_OF_CIRCLES );
		
// 		console.log( "cw:" + cw );
// 		console.log( "ch:" + ch );
// 		console.log( "R:" + cw );
		
		{
			let xOrig = 0;
			let yOrig = 0;
			let angAdd = 0;
			
			if ( canvas.width < canvas.height ) {
				xOrig = Math.random() * ( canvas.width - 2 * PAD ) + PAD;
				
				let k = Math.random();
				yOrig = k > 0.5 ? PAD : canvas.height - PAD;
				angAdd = k > 0.5 ? 0 : Math.PI;
				
// 				console.log( "First circle is " + k < 0.5 ? "up" : "down" + " at x = " + xOrig + ", y = " + yOrig );
// 				console.log( "angAdd is " + angAdd );
			} else {
				yOrig = Math.random() * ( canvas.height - 2 * PAD ) + PAD;
				
				let k = Math.random();
				xOrig = k > 0.5 ? PAD : canvas.width - PAD;
				angAdd = k > 0.5 ? 3 * Math.PI / 2 : Math.PI / 2 ;
				
// 				console.log( "First circle is " + k > 0.5 ? "right" : "left" + " at x = " + xOrig + ", y = " + yOrig );
// 				console.log( "angAdd is " + angAdd );
			}
			
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
// 				console.log ( "CIRCLE " + i + " Final Coords: ( " + xOrig + ", " + yOrig );
				let angle_offset = Math.random() * Math.PI * 2;
				createCircle( xOrig, yOrig, REST_R, RESTING_SPIN_RATE, angle_offset );
				
				if ( i == NUM_OF_CIRCLES - 1 )
					break;
				
				let theta = Math.random() * Math.PI;
				let cx = xOrig + DIST * Math.cos( theta );
				let cy = yOrig + DIST * Math.sin( theta );
				
				let bestx = cx;
				let besty = cy;
				let bestError = 50000000; // a big number
				
				const check = () => {
					let error = 0;
					const relu = ( x ) => x > 0 ? x : 0;
					
					error += relu( PAD - cx ) + relu( cx - ( canvas.width - PAD ) ) + relu( PAD - cy ) + relu( cy - ( canvas.height - PAD ) );
					
					for ( let j = 0; j < i; j++ ) {
						let x = cx - circles[ j * 4 ];
						let y = cy - circles[ j * 4 + 1 ];
						let squ = x * x + y * y;
						error += relu( DIST * DIST - squ );
					}
					
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
				
				const max_atts = 1000;
				let limit = max_atts;
				while ( check() && limit > 0 ) {
					theta = Math.random() * Math.PI + angAdd;
					cx = xOrig + DIST * Math.cos( theta );
					cy = yOrig + DIST * Math.sin( theta );
// 					console.log ( "CIRCLE " + (i + 1) + ", ATTEMPT " + (max_atts - limit + 1) + ": theta is " + theta + ", " + " coords are ( " + cx + ", " + cy + " }" );
					limit -= 1;
				}
				
				if ( check() == true ) {
// 					console.error( "Something is wrong on circle " + i + "!" );
					cx = bestx;
					cy = besty;
				}
				
				xOrig = cx;
				yOrig = cy;
			}
		}
			
		console.log( circleData );
		console.log( circles );
		
		const arcBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( circleData ), gl.STATIC_DRAW );
		
		const render = () => {
			gl.enableVertexAttribArray( vertexNum );
			gl.enableVertexAttribArray( Acenter );
			gl.enableVertexAttribArray( AR );
			gl.enableVertexAttribArray( Aang1 );
			gl.enableVertexAttribArray( Aang2 );
			gl.enableVertexAttribArray( Acolor );
		
			gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer )
			gl.vertexAttribPointer( vertexNum, 1, gl.FLOAT, false, 0, 0 );
			
			gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
			gl.vertexAttribPointer( Acenter, 2, gl.FLOAT, false, 10 * 4, 0 );
			gl.vertexAttribPointer( AR, 2, gl.FLOAT, false, 10 * 4, 2 * 4 );
			gl.vertexAttribPointer( Aang1, 1, gl.FLOAT, false, 10 * 4, 4 * 4 );
			gl.vertexAttribPointer( Aang2, 1, gl.FLOAT, false, 10 * 4, 5 * 4 );
			gl.vertexAttribPointer( Acolor, 4, gl.FLOAT, false, 10 * 4, 6 * 4 );
			
			gl.vertexAttribDivisor( Acenter, 1 );
			gl.vertexAttribDivisor( AR, 1 );
			gl.vertexAttribDivisor( Aang1, 1 );
			gl.vertexAttribDivisor( Aang2, 1 );
			gl.vertexAttribDivisor( Acolor, 1 );
			
			gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, 4, 3 * NUM_OF_CIRCLES );
			
			gl.disableVertexAttribArray( vertexNum );
			gl.disableVertexAttribArray( Acenter );
			gl.disableVertexAttribArray( AR );
			gl.disableVertexAttribArray( Aang1 );
			gl.disableVertexAttribArray( Aang2 );
			gl.disableVertexAttribArray( Acolor );
		};
		
		this.update = () => {
			gl.useProgram( program );
			
			for ( var i = 0; i < NUM_OF_CIRCLES; i++ ) {
				const one = circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE + 4 ];
				const two = circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE + 5 ];
				const thr = circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE * 2 + 4 ];
				const fou = circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE * 2 + 5 ];
				const rate = circles[ 4 * i + 2 ] * tDelta / 1000;
				
				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE + 4 ] = one + rate >= 2 * Math.PI ? one + rate - 2 * Math.PI : one + rate;
				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE + 5 ] = two + rate >= 2 * Math.PI ? two + rate - 2 * Math.PI : two + rate;
				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE * 2 + 4 ] = thr + rate >= 2 * Math.PI ? thr + rate - 2 * Math.PI : thr + rate;
				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE * 2 + 5 ] = fou + rate >= 2 * Math.PI ? fou + rate - 2 * Math.PI : fou + rate;
				
// 				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE + 4 ] = one + rate;
// 				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE + 5 ] = two + rate;
// 				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE * 2 + 4 ] = thr + rate;
// 				circleData[ CIRC_SIZE * 3 * i + CIRC_SIZE * 2 + 5 ] = fou + rate;
			}
			
			gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
			gl.bufferSubData( gl.ARRAY_BUFFER, 0, new Float32Array( circleData ), 0, Math.round( NUM_OF_CIRCLES * 3 * CIRC_SIZE ) );
			
			render();
		}
		
		this.resize = () => {
			gl.useProgram( program );
			gl.uniform2f( Uresolution, canvas.width, canvas.height );
			
			
		};
	} )();
	
	// resize
	const resize = () => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		cw = canvas.width / 2;
		ch = canvas.height / 2;
		gl.viewport( 0, 0, canvas.width, canvas.height );
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		
// 		bkgd.resize();
		circles.resize();
	};
	
	resize();
	window.onresize = resize;
	
	let tPrev = 0;
	let tDelta = 0;
	let mx = 0;
	let my = 0;
	
	const animate = ( tNow ) => {
		tDelta = tNow - tPrev;
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		
// 		console.log( tDelta );
		
// 		bkgd.update();
		circles.update();
		
		window.onmousemove = mousemove;	
		requestAnimationFrame( animate );
		tPrev = tNow;
	};
	
	const mousemove = ( e ) => {
		mx = e.clientX / cw - 1;
		my = -e.clientY / ch + 1;
		window.onmousemove = null;
	};
	
	tPrev = performance.now();
	requestAnimationFrame( animate );
};

window.onload = fn;

