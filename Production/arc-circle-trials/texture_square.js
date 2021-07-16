
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
	vss : `
		attribute vec2 Apos;
		attribute vec2 Atex;
		varying vec2 Vtex;
		
		void main () {
			gl_Position = vec4( Apos, 0., 1. );
			Vtex = Atex;
		}
	`,
	
	fss : `
		precision mediump float;
		varying vec2 Vtex;
		uniform sampler2D Uframe;
		
		void main () {
			gl_FragColor = texture2D( Uframe, Vtex );
		}
	`,

	init : function () {
		this.program2 = create_program_kun( this.vss, this.fss );
		gl.useProgram( this.program2 );

		this.image = document.getElementById( "fak" );
		
        gl.activeTexture( gl.TEXTURE0 );
		
		this.LOLZ = gl.createTexture();
		gl.bindTexture( gl.TEXTURE_2D, this.LOLZ );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		
		this.FRAMET = gl.createTexture();
		gl.bindTexture( gl.TEXTURE_2D, this.FRAMET );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, cv.width, cv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
		
		this.FRAMEB = gl.createFramebuffer();
		gl.bindFramebuffer( gl.FRAMEBUFFER, this.FRAMEB );
		gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.FRAMET, 0 );
		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		
		this.Apos = gl.getAttribLocation( this.program2, "Apos" );
		this.Atex = gl.getAttribLocation( this.program2, "Atex" );
		this.Uframe = gl.getUniformLocation( this.program2, "Uframe" );
		
		gl.uniform1i( this.Uframe, 0 );
		
		this.posBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.posBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array ( [ 
			1, 1,
			1, -1,
			-1, 1,
			-1, -1
		] ), gl.STATIC_DRAW );
		
		gl.enableVertexAttribArray( this.Apos );
		
		this.texBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.texBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array ( [ 
			1, 0,
			1, 1,
			0, 0,
			0, 1,
		] ), gl.STATIC_DRAW );

		gl.enableVertexAttribArray( this.Atex );
	},

	draw : function () {
        gl.useProgram( this.program2 );
        
 		gl.bindBuffer( gl.ARRAY_BUFFER, this.posBuffer );
 		gl.vertexAttribPointer( this.Apos, 2, gl.FLOAT, false, 0, 0 );
 		
 		gl.bindBuffer( gl.ARRAY_BUFFER, this.texBuffer );
 		gl.vertexAttribPointer( this.Atex, 2, gl.FLOAT, false, 0, 0 );
		
		gl.bindTexture( gl.TEXTURE_2D, this.LOLZ );
		gl.bindFramebuffer( gl.FRAMEBUFFER, this.FRAMEB );
		gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
		
		gl.bindTexture( gl.TEXTURE_2D, this.FRAMET );
		gl.bindFramebuffer( gl.FRAMEBUFFER, null );
		gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
	},
	
	resize : function () {
// 		this.draw()
	},
};

window.onload = init_kun;
