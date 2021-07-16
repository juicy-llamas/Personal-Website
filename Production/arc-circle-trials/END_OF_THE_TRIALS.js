
/*
 *	Common Section:
 */

var gl;
var cv;

/*
 *	Init: initializes the context / program.
 */
var init_kun = () => {
	
	// Get the canvas.
	cv = document.getElementById( "canvas_sama" );
	if ( cv === undefined ) {
		console.error( "your browser does not like canvas sama" );
		return;	}

	// Get gl context.
	gl = cv.getContext( "webgl2" );
	if ( gl === undefined ) {
		console.error( "your browser does not like webgl2 sama" );
		return;	}

	window.onresize = window_resize;
	window_resize();
	main.init();
	
	// gl clear color ( grey ).
	gl.clearColor( 0.1, 0.1, 0.1, 1.0 );
	gl.clearDepth( 1.0 );					// Clear everything
	gl.enable( gl.DEPTH_TEST );				// Enable depth testing
	gl.depthFunc( gl.LEQUAL );				// Near things obscure far things

	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

	main.draw();
};

/*
 *	Resize: resizes the canvas and gl window and anything else.
 */
var window_resize = () => {
	let x = window.innerWidth;
	let y = window.innerHeight;
	
	cv.width = x;
	cv.height = y;
	gl.viewport( 0, 0, x, y );
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
	
	main.resize();
};

/*
 *	Compile Shader: compiles a shader.
 */
var compile_shader_kun = ( src, type ) => {
	var ret = gl.createShader( type );
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

/*
 *	Create Program: creates a (complete) program from shader src.
 */
var create_program_kun = ( vss, fss ) => {
	var ret = gl.createProgram();
	
	// calls compile_shader_kun for the two shaders
	{
		let vs = compile_shader_kun( vss, gl.VERTEX_SHADER );
		let fs = compile_shader_kun( fss, gl.FRAGMENT_SHADER );

		gl.attachShader( ret, vs );
		gl.attachShader( ret, fs ); 
	}
	
	gl.linkProgram( ret );
	if ( gl.getProgramParameter( ret, gl.LINK_STATUS ) )
		return ret;
	else
		console.error( "a program kun did not link: " + gl.getProgramInfoLog( ret ) );
};

/*
 *	Put code in main.
 */
var main = {
	framev : `
		attribute vec2 Apos;
		attribute vec2 Atex;
		varying vec2 Vtex;
		
		void main () {
			gl_Position = vec4( Apos, 0., 1. );
			Vtex = Atex;
		}
	`,
	
	framef : `
		precision mediump float;
		varying vec2 Vtex;
		uniform sampler2D Uframe;
		uniform sampler2D Utexture;
		
		void main () {
			vec4 img = texture2D( Utexture, Vtex );
			vec4 frame = texture2D( Uframe, Vtex );
			gl_FragColor = mix( img, frame, frame.a );
		}
	`,
	
	arcv : `
		attribute float vertexNum;
		
		attribute vec2 Acenter;
		attribute vec2 AR;
		attribute float Aang1;
		attribute float Aang2;
		attribute vec4 Acolor;
		
		varying vec2 Vcenter;
		varying vec2 R2;
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
			R2 = AR * AR;
			Vang1 = Aang1;
			Vang2 = Aang2;
			Vcolor = Acolor;
		}
	`,
	
	arcf: `
		#ifdef GL_OES_standard_derivatives
        #extension GL_OES_standard_derivatives : enable
        #endif

        #define PI radians( 180. )
        #define TUPI radians( 360. )

        precision mediump float;

		varying vec2 Vcenter;
		varying vec2 R2;
		varying float Vang1;
		varying float Vang2;
		varying vec4 Vcolor;

        void main () {
            vec2 diff = gl_FragCoord.xy - Vcenter;
            float dist = dot( diff, diff );

            /*
                CHANGE THIS WAY OF DOING THINGS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! 
                YOU CAN DO THIS WITH MATRIX MATH.
            */
            float theta = atan( -diff.y, -diff.x ) + PI;

			// Define the margin of circle shading (either auto if dervs are on, or just fixed 10 px).
            #ifdef GL_OES_standard_derivatives
            float delta = fwidth( dist );
            delta = delta < 1. ? 1. : delta;
            #else
            float delta = 100.;
            #endif

            float deltaT = 0.015;
            float alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist )
                              - smoothstep( R2.y + delta, R2.y - delta, dist );

			// Fixed hole-in-the-circle problem, may make this better later.
			if ( dist < R2.x - delta && R2.y == 0. )
				alpha = 1.;
			
			// Angle alpha
            if ( Vang2 <= TUPI ) {
                alpha = alpha - smoothstep( Vang1 + deltaT, Vang1 - deltaT, theta )
                              - smoothstep( Vang2 - deltaT, Vang2 + deltaT, theta );
            }
            
            alpha = clamp( alpha, 0., 1. ) * Vcolor.a;

            if ( alpha == 0. )
                discard;
            
            gl_FragColor = vec4( Vcolor.rgb, alpha );
        }
	`,

	init : function () {
		this.program2 = create_program_kun( this.framev, this.framef );
		gl.useProgram( this.program2 );

		this.image = document.getElementById( "fak" );
		
		// TEXTURE / FRAMEB
		
		this.LOLZ = gl.createTexture();
        gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, this.LOLZ );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		
		this.FRAMET = gl.createTexture();
        gl.activeTexture( gl.TEXTURE1 );
		gl.bindTexture( gl.TEXTURE_2D, this.FRAMET );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, cv.width, cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		
		this.FRAMEB = gl.createFramebuffer();
		gl.bindFramebuffer( gl.FRAMEBUFFER, this.FRAMEB );
		gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.FRAMET, 0 );
		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		
		// IMG PROG
		
		this.Apos = gl.getAttribLocation( this.program2, "Apos" );
		this.Atex = gl.getAttribLocation( this.program2, "Atex" );
		this.Utexture = gl.getUniformLocation( this.program2, "Utexture" );
		this.Uframe = gl.getUniformLocation( this.program2, "Uframe" );
		
		this.posBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.posBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array ( [ 
			1, 1,
			1, -1,
			-1, 1,
			-1, -1
		] ), gl.STATIC_DRAW );
		
		this.texBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.texBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array ( [ 
			0, 0,
			0, 1,
			1, 0,
			1, 1,
		] ), gl.STATIC_DRAW );
		
		// CIRCLE PROG
        
		this.program = create_program_kun( this.arcv, this.arcf );
		gl.useProgram( this.program );
		
		this.vertexNum = gl.getAttribLocation( this.program, "vertexNum" );
		
		this.Acenter = gl.getAttribLocation( this.program, "Acenter" );
		this.AR = gl.getAttribLocation( this.program, "AR" );
		this.Aang1 = gl.getAttribLocation( this.program, "Aang1" );
		this.Aang2 = gl.getAttribLocation( this.program, "Aang2" );
		this.Acolor = gl.getAttribLocation( this.program, "Acolor" );
		
		this.Uresolution = gl.getUniformLocation( this.program, "Uresolution" );
		gl.uniform2f( this.Uresolution, cv.width, cv.height );
		
        this.numberOfVertices = 32;
        let dat = [];
        for ( let i = 0; i < this.numberOfVertices; i++ )
            dat[ i ] = i;
        
		this.vertexBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vertexBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, new Float32Array ( dat ), gl.STATIC_DRAW );
		
		this.arcBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.arcBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [
			300, 300, 90, 86, 0.2 * Math.PI, 0.9 * Math.PI , 0.8, 0.8, 0.8, 0.4,
			300, 300, 90, 86, 1.2 * Math.PI, 1.9 * Math.PI , 0.8, 0.8, 0.8, 0.4,
			300, 300, 64, 0, 0., 2. * Math.PI + 0.001, 0.8, 0.8, 0.8, 0.4,
		] ), gl.STATIC_DRAW );
		
	},

	draw : function () {
		
		// CIRcLE PROG
		
		gl.useProgram( this.program );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vertexBuffer );
		gl.vertexAttribPointer( this.vertexNum, 1, gl.FLOAT, false, 0, 0 );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, this.arcBuffer );
		gl.vertexAttribPointer( this.Acenter, 2, gl.FLOAT, false, 10 * 4, 0 );
		gl.vertexAttribPointer( this.AR, 2, gl.FLOAT, false, 10 * 4, 2 * 4 );
		gl.vertexAttribPointer( this.Aang1, 1, gl.FLOAT, false, 10 * 4, 4 * 4 );
		gl.vertexAttribPointer( this.Aang2, 1, gl.FLOAT, false, 10 * 4, 5 * 4 );
		gl.vertexAttribPointer( this.Acolor, 4, gl.FLOAT, false, 10 * 4, 6 * 4 );
		
		gl.enableVertexAttribArray( this.vertexNum );
		gl.enableVertexAttribArray( this.Acenter );
		gl.enableVertexAttribArray( this.AR );
		gl.enableVertexAttribArray( this.Aang1 );
		gl.enableVertexAttribArray( this.Aang2 );
		gl.enableVertexAttribArray( this.Acolor );
		
		gl.vertexAttribDivisor( this.Acenter, 1 );
		gl.vertexAttribDivisor( this.AR, 1 );
		gl.vertexAttribDivisor( this.Aang1, 1 );
		gl.vertexAttribDivisor( this.Aang2, 1 );
		gl.vertexAttribDivisor( this.Acolor, 1 );
		
		gl.bindFramebuffer( gl.FRAMEBUFFER, this.FRAMEB );
 		gl.bindTexture( gl.TEXTURE_2D, this.FRAMET );
		gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, this.numberOfVertices, 3 );
		
		gl.vertexAttribDivisor( this.Acenter, 0 );
		gl.vertexAttribDivisor( this.AR, 0 );
		gl.vertexAttribDivisor( this.Aang1, 0 );
		gl.vertexAttribDivisor( this.Aang2, 0 );
		gl.vertexAttribDivisor( this.Acolor, 0 );
		
		gl.disableVertexAttribArray( this.vertexNum );
		gl.disableVertexAttribArray( this.Acenter );
		gl.disableVertexAttribArray( this.AR );
		gl.disableVertexAttribArray( this.Aang1 );
		gl.disableVertexAttribArray( this.Aang2 );
		gl.disableVertexAttribArray( this.Acolor );
		
		// IMG PROG
		
		gl.useProgram( this.program2 );
        
		gl.bindBuffer( gl.ARRAY_BUFFER, this.posBuffer );
		gl.vertexAttribPointer( this.Apos, 2, gl.FLOAT, false, 0, 0 );
 		
		gl.bindBuffer( gl.ARRAY_BUFFER, this.texBuffer );
		gl.vertexAttribPointer( this.Atex, 2, gl.FLOAT, false, 0, 0 );
		
		gl.enableVertexAttribArray( this.Atex );
		gl.enableVertexAttribArray( this.Apos );
		
        gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, this.LOLZ );
		gl.uniform1i( this.Utexture, 0 );
		
        gl.activeTexture( gl.TEXTURE1 );
		gl.bindTexture( gl.TEXTURE_2D, this.FRAMET );
		gl.uniform1i( this.Uframe, 1 );
		
		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
		
		gl.disableVertexAttribArray( this.Atex );
		gl.disableVertexAttribArray( this.Apos );
	},
	
	resize : function () {
		
	},
};

window.onload = init_kun;
