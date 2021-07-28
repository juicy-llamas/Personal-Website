"use strict";

const fn = () => {
	const canvas = document.getElementById( "screen" );
	const gl = canvas.getContext( 'webgl2' );
	const image = document.getElementById( "image" );
	
	if ( canvas === undefined ) console.err( "Your browser does not support Canvas." );
	if ( gl === undefined ) console.err( "Your browser does not suppport WebGL2 (WebGL1 won't work)." );
	if ( image === undefined ) console.err( "Problem loading image." );
	
	let cw = canvas.width / 2;
	let ch = canvas.height / 2;

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
	
	const circles = new ( function () {
		const vs = `
			attribute float vertexNum;
			
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
				vec2 pos = ( AR.x * mask + cen ) / Uresolution * 2.;

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
				#else
				float delta = 150.;
				#endif

				float deltaT = 0.01;
				float alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist )
								- smoothstep( R2.y + delta, R2.y - delta, dist );

				if ( Vang2 <= TUPI ) {
					alpha = alpha - smoothstep( Vang1 + deltaT, Vang1 - deltaT, theta )
								- smoothstep( Vang2 - deltaT, Vang2 + deltaT, theta );
				}
				
				// Fixed hole-in-the-circle problem, may make this better later.
				if ( dist < R2.x - delta && R2.y == 0. )
					alpha = 1.;
				
				alpha = clamp( alpha, 0., 1. );

				if ( alpha == 0. )
					discard;
				
				// frame buffer???
				vec4 bkgd = vec4( vec3( 0.1 ), 1. );
				gl_FragColor = mix( bkgd, Vcolor, alpha );
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
		
		
		const arcBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, arcBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [
			300, 300, 100, 90, 0.2 * Math.PI, 0.9 * Math.PI , 0., 1., 0., 1.,
			300, 300, 100, 90, 1.2 * Math.PI, 1.9 * Math.PI , 0., 1., 0., 1.,
			300, 300, 60, 0, 0., 2. * Math.PI + 0.001, 0.9, 0.9, 0.9, 1.,
		] ), gl.STATIC_DRAW );
		
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
			
			gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, numberOfVertices, 3 );
			
			gl.disableVertexAttribArray( vertexNum );
			gl.disableVertexAttribArray( Acenter );
			gl.disableVertexAttribArray( AR );
			gl.disableVertexAttribArray( Aang1 );
			gl.disableVertexAttribArray( Aang2 );
			gl.disableVertexAttribArray( Acolor );
		};
		
		this.update = () => {
			gl.useProgram( program );
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
		
		bkgd.resize();
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
		
// 		console.log( tDelta );
		
		bkgd.update();
		
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




