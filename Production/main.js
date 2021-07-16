
var gl;
var cv;

/*
 *	Init: initializes the programs
 */
var init_kun = () => {
		
	cv = document.getElementById( "canvas_sama" );
	if ( cv === undefined ) {
		console.error( "your browser does not like canvas sama" );
		return;	}

	gl = cv.getContext( "webgl2" );
	if ( gl === undefined ) {
		console.error( "your browser does not like webgl2 sama" );
		return;	}

	// resize canvas, init, and turn the screen to dark grey.
	animate.resize_kun();
	animate.init();

	gl.clearColor( 0.1, 0.1, 0.1, 1.0 );
	gl.clearDepth(1.0);                 // Clear everything
	gl.enable(gl.DEPTH_TEST);           // Enable depth testing
	gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

	// gl program initializations
	bkgd.init();

	// animator controlls events from here
	animate.start_loop();

};


var compile_shader_kun = ( src, type ) => {
	var ret = gl.createShader( type );
	gl.shaderSource( ret, src );
	gl.compileShader( ret );

	if ( gl.getShaderParameter( ret, gl.COMPILE_STATUS ) )
		return ret;
	else {
		var typStr = type == gl.VERTEX_SHADER ? "vertex shader" : ( 
				type == gl.FRAGMENT_SHADER ? "fragment shader" : 
				"undefined shader" );
		console.error( "a(n) " + typStr + " shader did not compile: " + 
				gl.getShaderInfoLog( ret ) );
	}
};

var create_program_kun = ( vss, fss ) => {
	var ret = gl.createProgram();
	// calls compile_shader_kun for the two shaders
	var vs = compile_shader_kun( vss, gl.VERTEX_SHADER );
	var fs = compile_shader_kun( fss, gl.FRAGMENT_SHADER );

	gl.attachShader( ret, vs );
	gl.attachShader( ret, fs );
	gl.linkProgram( ret );

	if ( gl.getProgramParameter( ret, gl.LINK_STATUS ) )
		return ret;
	else
		console.error( "a program kun did not link: " + 
				gl.getProgramInfoLog( ret ) );
};

// need to type the data before passing it :))))))))))))))))))))))))
var create_buffer_kun = ( data, update ) => {
	var ret = gl.createBuffer();
	gl.bindBuffer( gl.ARRAY_BUFFER, ret );
	gl.bufferData( gl.ARRAY_BUFFER, data, update );
	return ret;
};

// assumes the image has already loaded.
var create_texture_kun = ( image ) => {
	var ret = gl.createTexture();
	gl.bindTexture( gl.TEXTURE_2D, ret );
	/* 
		texture, level of detail, image format, output format, output byte 
		format, image
	*/
	gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
			image );

	if ( image.width & ( image.width - 1 ) == 0 && image.height & 
			( image.height - 1 ) == 0 ) {
		// Power of 2
		gl.generateMipmap( gl.TEXTURE_2D );
	} else {
		// Not a power of 2
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
	}

	gl.activeTexture( gl.TEXTURE0 );
	return ret;
};

/*
 *	Background: defines the local environment for the GL background program,
 *	as well as a rendering function / environment.
 */
var bkgd = {
	// prog
	prog : undefined,
	// vars
	aNodePos : undefined,
	aTextCoord : undefined,
	uResolution : undefined,
	uTexture : undefined,
	uMouse : undefined,
	// bufs
	nodeData : undefined,
	textData : undefined,
	// bufObjs
	nodeBuffer : undefined,
	textBuffer : undefined,
	// Textures
	texture : undefined,
	// shader src (ss)
	vss : `
		attribute vec2 A_nodePos;
		attribute vec2 A_textCoord;
		varying highp vec2 V_textCoord;

		void main () {
			gl_Position = vec4( A_nodePos, 0.0, 1.0 );
			
			

			V_textCoord = A_textCoord;
		}
	`,

	fss : `
		precision mediump float;

		uniform vec2 U_resolution;
		uniform vec2 U_box_center;
		uniform vec2 U_mouse;
		uniform sampler2D U_texture;
		varying highp vec2 V_textCoord;

		void arc ( float R1, float R2, float startAng, float endAng ) {
			
		}

		void main () {
			float square_size = floor(2.0 + 30.0 * 0.5);

			vec2 center = square_size * floor( V_textCoord * 
					U_resolution / square_size ) + square_size * vec2(0.5, 0.5);
			vec2 center_norm = center / U_resolution;
			vec2 mous = U_mouse - U_box_center;
			vec3 pixel_color;

			if ( distance( center, mous ) < 100. )
				pixel_color = texture2D( U_texture, center_norm ).rgb;
			else
				pixel_color = texture2D( U_texture, V_textCoord ).rgb;

			gl_FragColor = vec4( pixel_color, 1.0 );
		}
	`,

	init : () => {
		// create and use the program.
		bkgd.prog = create_program_kun( bkgd.vss, bkgd.fss );
		if ( bkgd.prog === -1 ) {
			console.error( "program kun creation failed" );
			return;	}

		gl.useProgram( bkgd.prog );

		// fill the data buffers with original values.
		const px = ( 1 + bkgd.drawCont.weight );
		const py = ( 1 + bkgd.drawCont.weight );
		const nx = -px;
		const ny = -py;
		bkgd.nodeData = new Float32Array( [
			nx, ny,
			nx, py,
			px, ny,
			px, py,
		] );

		bkgd.textData = new Float32Array( [
			0, 1,
			0, 0,
			1, 1,
			1, 0
		] );

		// get the program vars
		bkgd.aNodePos = gl.getAttribLocation( bkgd.prog, "A_nodePos" );
		bkgd.aTextCoord = gl.getAttribLocation( bkgd.prog, "A_textCoord" );
		bkgd.uResolution = gl.getUniformLocation( bkgd.prog, "U_resolution" );
		bkgd.uTexture = gl.getUniformLocation( bkgd.prog, "U_texture" );
		bkgd.uMouse = gl.getUniformLocation( bkgd.prog, "U_mouse" );
		bkgd.uBoxCenter = gl.getUniformLocation( bkgd.prog, "U_box_center" );

		// create our buffer objects
		bkgd.nodeBuffer = create_buffer_kun( bkgd.nodeData, gl.DYNAMIC_DRAW );
		bkgd.textBuffer = create_buffer_kun( bkgd.textData, gl.STATIC_DRAW );

		// set up the texture
		bkgd.texture = create_texture_kun( document.getElementById( "MILK" ) );

		// set the uniform vars
		gl.uniform2f( bkgd.uResolution, cv.width, cv.height );
		gl.uniform2f( bkgd.uMouse, 0, 0 );
		gl.uniform2f( bkgd.uBoxCenter, 0, 0 );
		gl.uniform1i( bkgd.uTexture, 0 );

		// bind the vertex attributes to the buffer positions
		gl.bindBuffer( gl.ARRAY_BUFFER, bkgd.nodeBuffer );
		gl.vertexAttribPointer( bkgd.aNodePos, 2, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( bkgd.aNodePos );

		gl.bindBuffer( gl.ARRAY_BUFFER, bkgd.textBuffer );
		gl.vertexAttribPointer( bkgd.aTextCoord, 2, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( bkgd.aTextCoord );
	},

	drawCont : {

		weight : 0.1,
		f_mult : 0.00002,
		bx : 0,
		by : 0,

		render : function ( mx, my, cw, ch, delta ) {
			/*console.log( "BEFORE => bx: " + this.bx + ", by: " + this.by );
			console.log( "MOUSE => mx: " + mx + ", my: " + my );
			console.log( "CANVAS => cw: " + cw + ", ch: " + ch );
			console.log( "DELTA => " + delta );
			*/var fx = this.f_mult * ( mx - this.bx / this.weight );
			var fy = this.f_mult * ( my - this.by / this.weight );
			//console.log( "FORCE => fx: " + fx + ", fy: " + fy );

			this.bx = fx * delta * delta + this.bx;
			this.by = fy * delta * delta + this.by;
			//console.log( "AFTER => bx: " + this.bx + ", by: " + this.by );

			var update = bkgd.nodeData.map( ( elm, ind ) => {
				elm += ind % 2 ? this.by : this.bx;
				return elm;
			} );

			gl.uniform2f( bkgd.uBoxCenter, this.bx * cw, -this.by * ch );

			gl.bindBuffer( gl.ARRAY_BUFFER, bkgd.nodeBuffer );
			gl.bufferSubData( gl.ARRAY_BUFFER, 0, update, 0, 8 );
		},

		loc_resize_kun : () => {
			const mul = 1 + this.weight;
			bkgd.nodeData = new Float32Array( [
				0, 0,
				0, cv.height * mul,
				cv.width * mul, 0,
				cv.width * mul, cv.height * mul
			] );
		}
		
	}

};

/*
 *	Animate: this just defines the animation loop, events, and fps control.
 */
var animate = {

	cw : undefined,
	ch : undefined,
	mx : undefined,
	my : undefined,

	frameObj : undefined,

	init : function () {
		this.cw = cv.width / 2;
		this.ch = cv.height / 2;
		this.mx = this.cw;
		this.my = this.ch;
		this.fps_control.fpsDisp = document.getElementById( "framerate" );

		window.onresize = this.resize_kun;
		cv.onmousemove = this.mousemAAVE;
		window.onclose = window.onunload = window.onerror = window.onsuspend = 
				this.break_loop;
	},

	run : function ( tNow ) {
		var delta = this.fps_control.isFrameReady( tNow );

		if ( delta != 0 ) {
			// render calls
			bkgd.drawCont.render( this.mx, this.my, this.cw, this.ch, delta );
			// clear the screen and draw.
			gl.clear( gl.COLOR_BUFFER_BIT );
			gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
		}
		
		// request a frame and trigger the mouse event for the next frame.
		this.frameObj = requestAnimationFrame( ( t ) => { 
				this.run.call( animate, t ) } );
		cv.onmousemove = this.mousemAAVE;
	},

	break_loop : ( e ) => {
		cancelAnimationFrame( animate.frameObj );
		animate.fps_control.clear();
	},

	start_loop : ( e ) => {
		animate.frameObj = requestAnimationFrame( ( t ) => { 
				animate.run.call( animate, t ) } );
	},

	resize_kun : ( e ) => {	
		cv.width = window.innerWidth;
		cv.height = window.innerHeight;
		gl.viewport( 0, 0, cv.width, cv.height );

		animate.cw = cv.width / 2;
		animate.ch = cv.height / 2;
		animate.mx = 0;
		animate.my = 0;

		gl.uniform2f( bkgd.uResolution, cv.width, cv.height );
		gl.uniform2f( bkgd.uMouse, 0, 0 );

		// for obj in objects call resize_kun
		bkgd.drawCont.loc_resize_kun();
	},

	// In an attempt to make this run faster, mousemove only gets called when
	// it is toggled on. This is so that it can run once for every frame, and
	// only once.
	mousemAAVE : ( e ) => {
		animate.mx = e.clientX / animate.cw - 1;
		animate.my = -1 * ( e.clientY / animate.ch - 1 );
	
		const wt = 1 - bkgd.drawCont.weight;
		const wi = bkgd.drawCont.weight;
		gl.uniform2f( bkgd.uMouse, e.clientX * wt + wi * animate.cw, 
					 e.clientY * wt + wi * animate.ch );

		window.onmousemove = null;
	},

	// takes care of most fps stuff.
	fps_control : {

		tPrev : 0,
		fps : 0,
		fpsAvg : 0,
		fpsSum : 0,
		fpsMax : 144,
		fpsLow : 9000,
		fpsHigh : 0,
		fpsDisp : undefined,
		fpsUpdate : 15,
		frameCount : 0,

		updateFps : function () {
			// Computing a global moving average.

			var rfps = Math.round( this.fps * 100 ) / 100;
			this.fpsDisp.innerHTML = "FPS: " + rfps;

			/*var fpsLocAvg = this.fpsSum / this.fpsUpdate;
			this.fpsAvg = ( fpsLocAvg + this.fpsAvg ) / 2;

			// rounding values for disp.
			var rfps = Math.round( this.fps * 100 ) / 100;
			var rfpsAvg = Math.round( this.fpsAvg * 100 ) / 100;
			var rfpsLow = Math.round( this.fpsLow * 100 ) / 100;
			var rfpsHigh = Math.round( this.fpsHigh * 100 ) / 100;
			var rfpsMax = Math.round( this.fpsMax * 100 ) / 100;

			// print to disp.
			this.fpsDisp.innerHTML = "FPS: " + rfps + 
					"<br>FPS Average: " + rfpsAvg + "<br>FPS Low: " + rfpsLow +
					"<br>FPS High: " + rfpsHigh + "<br>FPS Max: " + rfpsMax;

			console.log( "FPS: " + rfps + 
					"<br>FPS Average: " + rfpsAvg + "<br>FPS Low: " + rfpsLow +
					"<br>FPS High: " + rfpsHigh + "<br>FPS Max: " + rfpsMax );

			// update fpsMax. fpsMax should be set so that fpsHigh
			var ratio = this.fpsAvg / this.fpsLow;
			if ( this.fpsMax < 600 && ratio < 1.2 )
				this.fpsMax += 2 / ratio;
			else if ( ratio > 1.6 )
				this.fpsMax -= 2 * ratio * this.fpsMax / 60;

			// reset values.
			this.fpsHigh = 0;
			this.fpsLow = 9000;
			this.fpsSum = 0;*/
		},

		// Returns the time delta between this frame and the last, or 0 if the
		// frame is too soon.
		isFrameReady : function ( tNow ) {
			// current fps = last frame execution time.
			if ( this.tPrev === 0 ) this.tPrev = tNow;
			var delta = tNow - this.tPrev;
			this.tPrev = tNow;

			

			var fpsNow = 1000 / delta;
			this.fps = fpsNow;
			this.frameCount++;

			if ( this.frameCount >= this.fpsUpdate ) {
				this.frameCount = 0;
				this.updateFps();
			}
			//	console.log( fpsNow );

			/*if ( fpsNow < this.fpsMax ) {
				this.tPrev = tNow;
				this.fps = fpsNow;
				if ( this.fpsLow > this.fps ) this.fpsLow = this.fps;
				if ( this.fpsHigh < this.fps ) this.fpsHigh = this.fps;
				this.fpsSum += this.fps;

				return delta;
			}
			return 0;*/
			return delta;
		},

		clear : function () {
			this.fpsDisp.innerHTML = "stopped";
			this.fpsAvg = this.fpsSum = this.fps = this.frameCount = 
					this.fpsHigh = 0;
			this.fpsLow = 9000;
		}

	},

};

window.onload = init_kun;

