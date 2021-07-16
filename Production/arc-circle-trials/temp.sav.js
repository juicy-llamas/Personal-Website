
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
			vec2 pos = ( ( AR.x + 3. ) * mask + cen ) / Uresolution * 2.;

			gl_Position = vec4( pos, 0., 1. );
		
			Vcenter = Acenter;
			VR = AR;
			Vang1 = Aang1;
			Vang2 = Aang2;
			Vcolor = Acolor;
		}
	`,
	
	fss: `
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
            float delta = 3.;
// 			float delta = 500.;
            #endif

			float deltaX = VR.x * delta;
			float deltaY = VR.y <= 5. ? delta : VR.y * delta;
            float alpha = 1.0 - smoothstep( R2.x - deltaX, R2.x + deltaX, dist )
                              - smoothstep( R2.y + deltaY, R2.y - deltaY, dist );

			float powAlpha = pow( alpha, 2./3. );
            float deltaT1 = 0.02 * powAlpha;
            float deltaT2 = 0.02 / powAlpha;
            if ( Vang2 < TUPI ) {
                alpha = alpha - smoothstep( Vang1 + deltaT1, Vang1 - deltaT2, theta )
                            - smoothstep( Vang2 - deltaT1, Vang2 + deltaT2, theta );
            }
            
            // Fixed hole-in-the-circle problem, may make this better later.
// 			if ( dist < R2.x - deltaX && R2.y == 0. )
// 				alpha = 1.;
            
            alpha = clamp( alpha, 0., 0.5 );

            if ( alpha == 0. )
                discard;
			
            // frame buffer???
            vec4 bkgd = vec4( vec3( 0.1 ), 1. );
            gl_FragColor = mix( bkgd, Vcolor, alpha );
        }
	`,

	init : function () {
		this.program = create_program_kun( this.vss, this.fss );
		gl.useProgram( this.program );
		
		this.vertexNum = gl.getAttribLocation( this.program, "vertexNum" );
		
		this.Acenter = gl.getAttribLocation( this.program, "Acenter" );
		this.AR = gl.getAttribLocation( this.program, "AR" );
		this.Aang1 = gl.getAttribLocation( this.program, "Aang1" );
		this.Aang2 = gl.getAttribLocation( this.program, "Aang2" );
		this.Acolor = gl.getAttribLocation( this.program, "Acolor" );
		
		this.Uresolution = gl.getUniformLocation( this.program, "Uresolution" );
		
		gl.uniform2f( this.Uresolution, cv.width, cv.height );
        
		this.vertexBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vertexBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [ 0, 1, 2, 3 ] ), gl.STATIC_DRAW );
		
		gl.vertexAttribPointer( this.vertexNum, 1, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( this.vertexNum );
		
		this.arcBuffer = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.arcBuffer );
		gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( [
			300, 300, 100, 90, 0.2 * Math.PI, 0.9 * Math.PI , 0., 1., 0., 1.,
			300, 300, 100, 90, 1.2 * Math.PI, 1.9 * Math.PI , 0., 1., 0., 1.,
			300, 300, 60, 0, 0., 2. * Math.PI + 0.001, 0.9, 0.9, 0.9, 1.,
		] ), gl.STATIC_DRAW );
		
		gl.enableVertexAttribArray( this.Acenter );
		gl.enableVertexAttribArray( this.AR );
		gl.enableVertexAttribArray( this.Aang1 );
		gl.enableVertexAttribArray( this.Aang2 );
		gl.enableVertexAttribArray( this.Acolor );

	},
	
	draw : function () {
		gl.bindBuffer( gl.ARRAY_BUFFER, this.arcBuffer );
		gl.vertexAttribPointer( this.Acenter, 2, gl.FLOAT, false, 10 * 4, 0 );
		gl.vertexAttribPointer( this.AR, 2, gl.FLOAT, false, 10 * 4, 2 * 4 );
		gl.vertexAttribPointer( this.Aang1, 1, gl.FLOAT, false, 10 * 4, 4 * 4 );
		gl.vertexAttribPointer( this.Aang2, 1, gl.FLOAT, false, 10 * 4, 5 * 4 );
		gl.vertexAttribPointer( this.Acolor, 4, gl.FLOAT, false, 10 * 4, 6 * 4 );
		
		gl.vertexAttribDivisor( this.Acenter, 1 );
		gl.vertexAttribDivisor( this.AR, 1 );
		gl.vertexAttribDivisor( this.Aang1, 1 );
		gl.vertexAttribDivisor( this.Aang2, 1 );
		gl.vertexAttribDivisor( this.Acolor, 1 );
		
		gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, 4, 3 );
	},
	
	resize : function () {
		gl.uniform2f( this.Uresolution, cv.width, cv.height );
	},
};

window.onload = init_kun;
