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
	
	// for animation
	let tPrev = 0;
	let tDelta = 0;
	let mx = -1;
	let my = -1;
	
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
		const SPINNY_SPIN_RATE = 20;
		const OVER_SPIN_RATE = 0;
		const SPIN_TOLERANCE = 0.01;
		
		const CIRC_SIZE = 10;
		const CIRCLES_SIZE = 7;
		
		let circleData = [];
		let circles = [];
		
		const colorCenter = [ .9, .9, .9, 1 ];
		const colorSides = [ 0, 1, 0, 1 ];

		const createCircle = ( cx, cy, r, spin, angle_offset ) => {
			circles.push( cx );
			circles.push( cy );
			circles.push( spin );
			circles.push( r );
			circles.push( r );	// r goal radius
			circles.push( 0 );	// r'
			circles.push( spin );	// spin goal
			let ang1 = angle_offset + Math.PI > Math.PI * 2 ? angle_offset - Math.PI : angle_offset + Math.PI;
			let ang2 = angle_offset + Math.PI * 1.7 > Math.PI * 2 ? angle_offset - Math.PI * 0.3 : angle_offset + Math.PI * 1.7;
			let ang3 = angle_offset + Math.PI * 0.7 > Math.PI * 2 ? angle_offset - Math.PI * 1.3 : angle_offset + Math.PI * 0.7;
			
			circleData = [ ...circleData, 
				cx, cy, r * 0.6, 0, 0, 2. * Math.PI + 0.001 , ...colorCenter,
				cx, cy, r, r * 0.9, ang1, ang2, ...colorSides,
				cx, cy, r, r * 0.9, angle_offset, ang3, ...colorSides,
			];
		};

		const updateCircle/*s?*/ = ( index ) => {
			const cx = circles[ index * CIRCLES_SIZE + 0 ];
			const cy = circles[ index * CIRCLES_SIZE + 1 ];
			let spin = circles[ index * CIRCLES_SIZE + 2 ];
			let r = circles[ index * CIRCLES_SIZE + 3 ];
			const r_goal = circles[ index * CIRCLES_SIZE + 4 ];
			let r_p = circles[ index * CIRCLES_SIZE + 5 ];
			let spin_goal = circles[ index * CIRCLES_SIZE + 6 ];
			
			const k_r = 0.00002;
			const damp = 0.04;
			const r_pp = k_r * ( r_goal - r );
			r_p = r_p + ( r_pp ) * tDelta - r_p * damp;
			r = r + r_p * tDelta;
			
			let k_spin = 0.005;
			switch ( spin_goal ) {
				case RESTING_SPIN_RATE:
					k_spin = 0.003;
					break;
				case SPINNY_SPIN_RATE:
					k_spin = 0.01;
					break;
				case OVER_SPIN_RATE:
					k_spin = 0.003;
					break;
			}
			const spin_p = k_spin * ( spin_goal - spin );
// 			if ( spin_goal === OVER_SPIN_RATE )
// 				spin = spin + spin_p * spin_p * tDelta;
// 			else
				spin = spin + spin_p * tDelta;
			if ( spin >= spin_goal - SPIN_TOLERANCE && spin_goal === SPINNY_SPIN_RATE ) {
				spin_goal = OVER_SPIN_RATE;
				console.log( "heyeeeeee" );
			}
			
			circleData[ index * CIRC_SIZE * 3 + 0 ] = cx;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE ] = cx;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 ] = cx;
			circleData[ index * CIRC_SIZE * 3 + 1 ] = cy;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE + 1 ] = cy;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 + 1 ] = cy;
			circleData[ index * CIRC_SIZE * 3 + 2 ] = r * 0.6;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE + 2 ] = r;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE + 3 ] = r * 0.9;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 + 2 ] = r;
			circleData[ index * CIRC_SIZE * 3 + CIRC_SIZE * 2 + 3 ] = r * 0.9;
			
			circles[ index * CIRCLES_SIZE + 5 ] = r_p;
			circles[ index * CIRCLES_SIZE + 3 ] = r;
			circles[ index * CIRCLES_SIZE + 2 ] = spin;
			circles[ index * CIRCLES_SIZE + 6 ] = spin_goal;

			const one = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 4 ];
			const two = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 5 ];
			const thr = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 4 ];
			const fou = circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 5 ];
			const rate = spin * tDelta / 1000;

			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 4 ] = one + rate >= 2 * Math.PI ? one + rate - 2 * Math.PI : one + rate;
			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE + 5 ] = two + rate >= 2 * Math.PI ? two + rate - 2 * Math.PI : two + rate;
			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 4 ] = thr + rate >= 2 * Math.PI ? thr + rate - 2 * Math.PI : thr + rate;
			circleData[ CIRC_SIZE * 3 * index + CIRC_SIZE * 2 + 5 ] = fou + rate >= 2 * Math.PI ? fou + rate - 2 * Math.PI : fou + rate;
		}
		
		if ( canvas.width < 1920 || canvas.height < 1080 )
			console.warn( "Rendering circles on a screen that is sub HD--are you sure you want to do this?" );
		
		// changes with resize
		let REST_R = Math.min( cw, ch ) / NUM_OF_CIRCLES;
		let EXP_R = REST_R * 1.3;
		let PAD = EXP_R + Math.min( cw, ch ) * 0.25;
		let DIST = Math.max( canvas.width, canvas.height ) * 1.1 / ( NUM_OF_CIRCLES );
		
		// This places the circles initially
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
						let x = cx - circles[ j * CIRCLES_SIZE ];
						let y = cy - circles[ j * CIRCLES_SIZE + 1 ];
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
			
// 			gl.vertexAttribDivisor( Acenter, 1 );
// 			gl.vertexAttribDivisor( AR, 1 );
// 			gl.vertexAttribDivisor( Aang1, 1 );
// 			gl.vertexAttribDivisor( Aang2, 1 );
// 			gl.vertexAttribDivisor( Acolor, 1 );
			
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
				updateCircle( i );
			}

			gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
			gl.bufferSubData( gl.ARRAY_BUFFER, 0, new Float32Array( circleData ), 0, Math.round( NUM_OF_CIRCLES * 3 * CIRC_SIZE ) );
			
			render();
		}

		this.mousemove = ( mouse_x, mouse_y ) => {
// 			let magic = -1;
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				const cx = circles[ i * CIRCLES_SIZE + 0 ];
				const cy = circles[ i * CIRCLES_SIZE + 1 ];
				const r = circles[ i * CIRCLES_SIZE + 3 ];
				
				const adj_x = mouse_x - cx;
				const adj_y = mouse_y - cy;
				
// 				console.log( 'mx : ' + mouse_x + ', my : ' + mouse_y );
// 				console.log( 'cx : ' + cx + ', cy : ' + cy + ', r : ' + r );
				
				if ( adj_x * adj_x + adj_y * adj_y <= r * r ) {
// 					magic = i;
					circles[ i * CIRCLES_SIZE + 4 ] = EXP_R;
					if ( circles[ i * CIRCLES_SIZE + 6 ] != OVER_SPIN_RATE )
						circles[ i * CIRCLES_SIZE + 6 ] = SPINNY_SPIN_RATE;
				} else {
					circles[ i * CIRCLES_SIZE + 4 ] = REST_R;
					circles[ i * CIRCLES_SIZE + 6 ] = RESTING_SPIN_RATE;
				}
			}
			
// 			if ( magic == -1 ) console.log( 'no' );
// 			else console.warn( 'yES! magic: ' +  magic );
		};
		
		this.resize = ( ow, oh ) => {
			gl.useProgram( program );
			gl.uniform2f( Uresolution, canvas.width, canvas.height );
			
			REST_R = Math.min( cw, ch ) / NUM_OF_CIRCLES;
			EXP_R = REST_R * 1.3;
			PAD = EXP_R + Math.min( cw, ch ) * 0.25;
			DIST = Math.max( canvas.width, canvas.height ) * 1.1 / ( NUM_OF_CIRCLES );
			
			const w_ratio = canvas.width / ow;
			const h_ratio = canvas.height / oh;
			
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				circles[ i * CIRCLES_SIZE + 0 ] *= w_ratio;
				circles[ i * CIRCLES_SIZE + 1 ] *= h_ratio;
			}
			
			// update the circle's radius
			this.mousemove( ( mx + 1 ) * cw, - ( my - 1 ) * ch );
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
			
			void main() {
				vec4 fg_color = texture2D( UtexFg, VtexFg );
				gl_FragColor = mix( texture2D( UtexBk, VtexBk ), fg_color, fg_color.a );
			}
		`;
		
		const program = create_program( vs, fs );
		gl.useProgram( program );

		const Apos = gl.getAttribLocation( program, "Apos" );
		const Abk = gl.getAttribLocation( program, "AtexBk" );
		const Ubk = gl.getUniformLocation( program, "UtexBk" );
		const Afg = gl.getAttribLocation( program, "AtexFg" );
		const Ufg = gl.getUniformLocation( program, "UtexFg" );

		gl.activeTexture( gl.TEXTURE0 );
		const tex_bk = gl.createTexture();
		
		gl.bindTexture( gl.TEXTURE_2D, tex_bk );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		
		gl.uniform1i( Ubk, 0 );
		
		gl.activeTexture( gl.TEXTURE1 );
		const tex_fg = gl.createTexture();
		
		gl.bindTexture( gl.TEXTURE_2D, tex_fg );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image2 );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		
		gl.uniform1i( Ufg, 1 );
		
		const extra_scale = 0.1;
		
		const bk_arr = new Float32Array( [ 1 - extra_scale, 1 - extra_scale,
										   1 - extra_scale, 0 + extra_scale,
										   0 + extra_scale, 1 - extra_scale,
										   0 + extra_scale, 0 + extra_scale ] );
		const pos_buf = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, pos_buf );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ -1, -1,
															-1,  1,
															1, -1,
															1,  1 ] ), gl.DYNAMIC_DRAW );

		const bk_buf = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, bk_buf );
		gl.bufferData( gl.ARRAY_BUFFER, bk_arr, gl.STATIC_DRAW );
		
		const fg_buf = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, fg_buf );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ 0, 1,
															0, 0,
															1, 1,
															1, 0 ] ), gl.STATIC_DRAW );
		
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
		
		const v_mult = 0.0001;
		this.x = 0;
		this.y = 0;
		
		this.update = () => {
			gl.useProgram( program );
				
			let velx = v_mult * ( mx - this.x / extra_scale );
			let vely = v_mult * ( my - this.y / extra_scale );
			
			this.x += velx * tDelta;
			this.y += vely * tDelta;
			
			addToBkBuff();
			render();
		};
		
		this.resize = () => {};
		
	} )();
	
	const resize = () => {
		const canvw = canvas.width;
		const canvh = canvas.height;
		
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		cw = canvas.width / 2;
		ch = canvas.height / 2;
		gl.viewport( 0, 0, canvas.width, canvas.height );
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		
		circles.resize( canvw, canvh );
		bkgd.resize();
	};
	
	resize();
	window.onresize = resize;
	
	const animate = ( tNow ) => {
		tDelta = tNow - tPrev;
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		
// 		console.log( tDelta );
		
		circles.update();
		bkgd.update();
		
		window.onmousemove = mousemove;	
		requestAnimationFrame( animate );
		tPrev = tNow;
	};
	
	const mousemove = ( e ) => {
		mx = e.clientX / cw - 1;
		my = -e.clientY / ch + 1;
		window.onmousemove = null;

		circles.mousemove( e.clientX, canvas.height - e.clientY );
	};
	
	tPrev = performance.now();
	requestAnimationFrame( animate );
};

window.onload = fn;

