
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

	main.init();
	window.onresize = window_resize;
	window_resize();
	
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
		attribute float vertexNum;
		attribute vec3 Acolor;
		
		varying vec3 Vcolor;
		
		void main () {
			vec2 mask = vec2( sign( ( vertexNum - 1.5 ) / 2.0 ), sign( ( mod( vertexNum, 2.0 ) - 0.5 ) ) );
			vec2 pos = vec2( 0.5, 0.5 ) * mask;
		
			Vcolor = Acolor;
			gl_Position = vec4( pos, 0., 1. );
		}
	`,
	
	fss: `
		precision mediump float;
		varying vec3 Vcolor;
		
		void main () {
			gl_FragColor = vec4( Vcolor, 1. );
		}
	`,

	init : function () {
		this.program = create_program_kun( this.vss, this.fss );
		gl.useProgram( this.program );
		
		this.vertexNum = gl.getAttribLocation( this.program, "vertexNum" );
		this.Acolor = gl.getAttribLocation( this.program, "Acolor" );
		
		this.vertexBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vertexBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array ( [ 
			0, 1, 2, 3
		] ), gl.STATIC_DRAW );
		
		gl.vertexAttribPointer( this.vertexNum, 1, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( this.vertexNum );
		
		this.colorBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.colorBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [
			0, 1, 1,
		] ), gl.STATIC_DRAW );

		gl.vertexAttribPointer( this.Acolor, 3, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( this.Acolor );
		gl.vertexAttribDivisor( this.Acolor, 1 );
	},

	draw : function () {
		gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, 4, 1 );
	},
	
	resize : function () {
		
	},
};

window.onload = init_kun;
