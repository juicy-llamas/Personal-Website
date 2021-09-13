
/*
 * Circle WebGL Backend (circle is kinda misleading since it can also draw arcs).
 *
 * (c) Daniel Moylan 2021
 */

"use strict";

/*
 * We need the number of circles to define our render loop / instance count.
 * Since that doesn't change, we can just pass it as an argument to our function.
 */
const circle_gl = function ( circle_num ) {

	// Vertex Shader
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

	// Fragment Shader
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
			float alpha = 0.;

			#ifdef GL_OES_standard_derivatives
			float delta = fwidth( dist );
			delta = delta < 1. ? 1. : delta;
			#else
			float delta = 2. * VR.x;
			#endif

			if ( dist < R2.x - delta && R2.y == 0. ) {
				alpha = 1.;
			} else {
				float theta = atan( -diff.y, -diff.x ) + PI;

				float deltaT = 0.015;
				alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist )
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

				alpha = clamp( alpha, 0., 1. );

				if ( alpha == 0. )
					discard;
			}

			gl_FragColor = vec4( Vcolor.rgb, Vcolor.a * alpha );
		}
	`;


	// Create program from shaders
	const program = create_program( vs, fs );
	gl.useProgram( program );

	// Set up all of our vertices and uniforms
	const vertexNum = gl.getAttribLocation( program, "vertexNum" );

	const Acenter = gl.getAttribLocation( program, "Acenter" );
	const AR = gl.getAttribLocation( program, "AR" );
	const Aang1 = gl.getAttribLocation( program, "Aang1" );
	const Aang2 = gl.getAttribLocation( program, "Aang2" );
	const Acolor = gl.getAttribLocation( program, "Acolor" );

	const Uresolution = gl.getUniformLocation( program, "Uresolution" );

	// Binding the vertexNum buffer (which is just a selector for our coords since Acenter and AR control where we are).
	const vertexBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ 0, 1, 2, 3 ] ), gl.STATIC_DRAW );

	// Number of vertex array elements per circle.
	this.elms_per_circle = 10;
	// Defines the array for the control attributes so it can be edited outside the func.
	this.circleBuffer = new Float32Array( circle_num * elms_per_circle );

	// arcBuffer is a different name then circleBuffer, and is the gl buffer obj that loads circleBuffer
	const arcBuffer = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, this.circleBuffer, gl.STATIC_DRAW );

	this.render = () => {
		// We use this program.
		gl.useProgram( program );

		// We update the gl buffer with our presumably new information.
		gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
		gl.bufferSubData( gl.ARRAY_BUFFER, 0, this.circleBuffer, 0, Math.round( circle_num * elms_per_circle ) );

		// Enable all vertex attribs to start (the ones we need)
		gl.enableVertexAttribArray( vertexNum );
		gl.enableVertexAttribArray( Acenter );
		gl.enableVertexAttribArray( AR );
		gl.enableVertexAttribArray( Aang1 );
		gl.enableVertexAttribArray( Aang2 );
		gl.enableVertexAttribArray( Acolor );

		// Load data into the buffers.
		gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer )
		gl.vertexAttribPointer( vertexNum, 1, gl.FLOAT, false, 0, 0 );

		gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
		gl.vertexAttribPointer( Acenter, 2, gl.FLOAT, false, 10 * 4, 0 );
		gl.vertexAttribPointer( AR, 2, gl.FLOAT, false, 10 * 4, 2 * 4 );
		gl.vertexAttribPointer( Aang1, 1, gl.FLOAT, false, 10 * 4, 4 * 4 );
		gl.vertexAttribPointer( Aang2, 1, gl.FLOAT, false, 10 * 4, 5 * 4 );
		gl.vertexAttribPointer( Acolor, 4, gl.FLOAT, false, 10 * 4, 6 * 4 );

		// (important) Lets GL know that these attribs apply once per *instance*, instance being a circle.
		// Note that vertexNum is not specified since it is defined once per *point*
		gl.vertexAttribDivisor( Acenter, 1 );
		gl.vertexAttribDivisor( AR, 1 );
		gl.vertexAttribDivisor( Aang1, 1 );
		gl.vertexAttribDivisor( Aang2, 1 );
		gl.vertexAttribDivisor( Acolor, 1 );

		// Output to a framebuffer so that we can do more rendering
		gl.bindFramebuffer( gl.FRAMEBUFFER, fbs.fb1 );

		// Draws 3 * circle_num *instances*, each instance having 4 vertices (they're squares)
		gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, 4, circle_num );

		// We set the framebuffer to null by default, which is the canvas.
		gl.bindFramebuffer( gl.FRAMEBUFFER, null );

		// We disable the vertex attrib arrays. If a program requires less vertex attribs in the future, we can't have more enabled.
		gl.disableVertexAttribArray( vertexNum );
		gl.disableVertexAttribArray( Acenter );
		gl.disableVertexAttribArray( AR );
		gl.disableVertexAttribArray( Aang1 );
		gl.disableVertexAttribArray( Aang2 );
		gl.disableVertexAttribArray( Acolor );
	};

	// Here we set the size of the uniform, which is just the canvas size (canvas is a global var).
	this.resize = () => {
		gl.uniform2i( Uresolution, canvas.width, canvas.height );
	};

};
