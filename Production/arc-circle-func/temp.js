
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

	window.onresize = main.resize();
	main.resize();
	// other events...
	main.init();
	
	// gl clear color ( grey ).
	gl.clearColor( 0.1, 0.1, 0.1, 1.0 );
	gl.clearDepth( 1.0 );					// Clear everything
	gl.enable( gl.DEPTH_TEST );				// Enable depth testing
	gl.depthFunc( gl.LEQUAL );				// Near things obscure far things

	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

	main.anim_loop();
// 	main.draw();
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
	init : function () {
		Arcs.init();
		this.menu_item = new MenuSelector.menuItem( 300, 300, 100, 3, 0.5 * Math.PI, 0 );
	},
	
	render : function () {
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
		
		Arcs.render();
	},
	
	update : function ( time ) {
		this.menu_item.update( time );
	},
	
	resize : function () {
		let x = window.innerWidth;
		let y = window.innerHeight;
		
		cv.width = x;
		cv.height = y;
		gl.viewport( 0, 0, x, y );
		gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
	},
	
	mouseHandling : {
		mouseCatchArr : [],
		mouseMove : function ( e ) {
			e.preventDefault();
			this.mouseCatchArr.forEach( ( elm ) => {
				elm( e.eventX, e.eventY );
			} );
			cv.removeEventListener( "mousemove", this.mouseMove, { capture: true } );
		},
		touch : function ( e ) {
			e.preventDefault();
			this.mouseCatchArr.forEach( ( elm ) => {
				elm( e.changedTouches[ 0 ].eventX, e.changedTouches[ 0 ].eventY );
			} );;
			cv.removeEventListener( "touchmove", this.touch, { capture: true } );
			cv.removeEventListener( "touchstart", this.touch, { capture: true } );
		},
		deployEvents : function () {
			cv.addEventListener( "mousemove", this.mouseMove, { capture: true } );
			cv.addEventListener( "touchstart", this.touch, { capture: true } );
			cv.addEventListener( "touchmove", this.touch, { capture: true } );
		},
		recallEvents : function () {
			cv.removeEventListener( "mousemove", this.mouseMove, { capture: true } );
			cv.removeEventListener( "touchstart", this.touch, { capture: true } );
			cv.removeEventListener( "touchmove", this.touch, { capture: true } );
		}
	},
	
	off : false,
	time : 0,
	anim_loop : function ( tnow = 0 ) {
		mouseHandling.deployEvents();
		
		let time = tnow - this.time;
		this.time += time;
		
		this.update( time / 1000 );
		this.render();
		
		if ( !this.off )
			requestAnimationFrame( ( tt ) => { this.anim_loop.call( main, tt ); } );
	}
};

var MenuSelector = ( function () {
	
	// Global Settings
	const color = [ 0.8, 0.8, 0.8, 0.4 ];
	const theta = 0.8 * Math.PI;
	const innerPercent = 0.64;
	const outerPercent = 0.05;
	
	const sInnerPercent = 0.9;
	const sOuterPercent = 0.05;
	const sGrowthPercent = 1.2;
	
	// Individual Menu Items
	var menuItem = function ( x, y, r, bandNumber, bandTheta, thetaOffset, velocity, animationFuncBands, animationFuncCenter, animationTime ) {
		this.innerCircle = new Arcs.arc( x, y, r * innerPercent, 0, 0, 2 * Math.PI, ...color );
		if ( bandTheta * bandNumber >= Math.PI * 2 ) {
			if ( bandNumber > 1 )
				console.warn( "MenuSelector.menuItem : bandTheta * bandNumber > 2 PI. Bands will render continuously, like a ring. \
							   \nIf this is your intention, consider using only one band." );
			this.ring = true;
		}
			
		let bandAngBetween = 2 * Math.PI / bandNumber - bandTheta;
		this.bands = [];
		for ( let i = 0; i < bandNumber; i++ ) {
			let theta1 = thetaOffset + bandAngBetween * i + bandTheta * i;
			theta1 = theta1 > Math.PI * 2 ? theta1 - Math.PI * 2 : theta1;
			let theta2 = theta1 + bandTheta;
			theta2 = theta2 > Math.PI * 2 ? theta2 - Math.PI * 2 : theta2;
			
			this.bands.push( new Arcs.arc( x, y, r, r * ( 1 - outerPercent ), theta1, theta2, ...color ) );
		}
		
		main.mouseHandling.mouseCatchArr.push( this.mouseCatch );
		
		this.animFuncB = animationFuncBands;
		this.animFuncC = animationFuncCenter;
		this.animDurr = animationTime;
		
		this.r = r;
		this.x = x;
		this.y = y;
		this.angularVelocity = 0.05;
		this.radialVelocity = 0;
		this.mouseOverTime = -1.;
		return this;
	}
	
	menuItem.prototype.update = function ( time ) {
		if ( this.mouseOverTime !== -1 ) {
			let percentComplete = ( time - this.mouseOverTime ) / this.animDurr;
			if ( percentComplete < 1 ) {
				this.animFuncB( this.angularVelocity, percentComplete );
				this.animFuncC( this.radialVelocity, percentComplete );
			} else { 
				if ( this.innerCircle. )
			}
		}
		
		this.innerCircle.addArgs( 2, this.radialVelocity * time );
		this.bands.forEach( ( elm ) => {
			elm.addArgs( 2, this.radialVelocity * time, this.radialVelocity * time, this.angularVelocity * time, this.angularVelocity * time ); 
		} );
	}
	
	menuItem.prototype.mouseCatch = function ( x, y ) {
		let relX = ( x - this.x );
		let relY = ( y - this.y );
		let relR = ( innerPercent * this.r );
		if ( relR * relR >= relX * relX + relY * relY )
			this.mouseOverTime = main.time;
	}
	
	return {
		menuItem : menuItem
	};
} )();

var Arcs = ( function () {
	
	var arcv = `
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
	`;
	
	var arcf =  `
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

            float alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist )
                              - smoothstep( R2.y + delta, R2.y - delta, dist );
			
			// Angle alpha
            float deltaT = 0.015;
			
            if ( Vang2 <= TUPI ) {
				if ( Vang2 < Vang1 && Vang1 <= TUPI ) {
					alpha = alpha - smoothstep( Vang1 + deltaT, Vang1 - deltaT, theta )
								  + smoothstep( Vang2 + deltaT, Vang2 - deltaT, theta );
				} else {
					alpha = alpha - smoothstep( Vang1 + deltaT, Vang1 - deltaT, theta )
								  - smoothstep( Vang2 - deltaT, Vang2 + deltaT, theta );
				}
            }
            
            // Fixed hole-in-the-circle problem, may make this better later.
			if ( dist < R2.x - delta && R2.y == 0. )
				alpha = 1.;
            
            alpha = clamp( alpha, 0., 1. ) * Vcolor.a;

            if ( alpha == 0. )
                discard;
            
            vec4 bkgd = vec4( vec3( 0.1 ), 1. );
            gl_FragColor = mix( bkgd, Vcolor, alpha );
        }
	`;
	
	var arcProg;
	var vertexNum;
	var Uresolution;
	var Acenter;
	var AR;
	var Aang1;
	var Aang2;
	var Acolor;
	var Bvertex;
	var Bcircle;
	var Dvertex;
	var Dcircle;
	
	var outFrameb;
	var outText;
	
	var circleCount = 0;
	
	/*
	 * Arc class
	 */
	
	var arcClass = function () {
		if ( arguments.length != 10 ) {
			console.error( "arcClass: new object must have ten arguments." );
			return -1;
		}
		
		Dcircle = new Float32Array( [ ...Dcircle, ...arguments ] );
		Dvertex = new Float32Array( [ ...Dvertex, 0, 1, 2, 3 ] );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, Bcircle );
		gl.bufferData( gl.ARRAY_BUFFER, Dcircle, gl.DYNAMIC_DRAW );
		gl.bindBuffer( gl.ARRAY_BUFFER, Bvertex );
		gl.bufferData( gl.ARRAY_BUFFER, Dvertex, gl.STATIC_DRAW );
		
		this.loc = circleCount++;
		return this;
	}
	
	arcClass.prototype.updateArgs = function ( offset, ...values ) {
		if ( offset + values.length > 10 ) {
			console.error( "arcClass.updateArgs: array (size: " + values.length + ") with offset (" + offset + ") will overwrite other entries in the buffer. You can only write to one object at a time." );
			return -1;
		} else if ( offset < 0 ) {
			console.error( "arcClass.updateArgs: negative offsets are invalid." );
			return -1;
		}
		
		let realOffset = this.loc * 10 + offset;
		
		Dcircle.set( values, realOffset );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, Bcircle );
		gl.bufferSubData( gl.ARRAY_BUFFER, realOffset * 4, Dcircle, realOffset, values.length );
	}
	
	arcClass.prototype.getArgs = function ( offset, amt ) {
		if ( offset + values.length > 10 ) {
			console.warn( "arcClass.getArgs: returned array will include arguments from (an)other object(s)." );
		} else if ( offset < 0 ) {
			console.error( "arcClass.getArgs: negative offsets are invalid." );
			return -1;
		}
		
		let realOffset = this.loc * 10 + offset;
		return Dcircle.slice( realOffset, realOffset + amt );
	}
	
	arcClass.prototype.addArgs = function ( offset, ...values ) {
		if ( offset + values.length > 10 ) {
			console.error( "arcClass.addArgs: array (size: " + values.length + ") with offset (" + offset + ") overwrote other entries in the buffer. You can only add to one object at a time." );
			return -1;
		} else if ( offset < 0 ) {
			console.error( "arcClass.addArgs: negative offsets are invalid." );
			return -1;
		}
		
		let realOffset = this.loc * 10 + offset;
		
		for ( var i = 0; i < values.length; i++ ) {
			Dcircle[ i + realOffset ] += values[ i ];
			if ( ( i + offset === 4 || i + offset === 5 ) && Dcircle[ i + realOffset ] > 2 * Math.PI )
				Dcircle[ i + realOffset ] -= 2 * Math.PI;
		}
		
		gl.bindBuffer( gl.ARRAY_BUFFER, Bcircle );
		gl.bufferSubData( gl.ARRAY_BUFFER, realOffset * 4, Dcircle, realOffset, values.length );
	}
	
	arcClass.prototype.destroy = function () {
		if ( this.loc >= circleCount || loc < 0 ) {
			console.error( "arcClass.destroy: object location must be valid." );
			return -1;
		}
		
		let circOff = this.loc * 10;
		let vertOff = this.loc * 4;
		Dcircle = new Float32Array( [ ...( Dcircle.subarray( 0, circOff ) ), ...( Dcircle.subarray( circOff + 10 ) ) ] );
		Dvertex = new Float32Array( [ ...( Dvertex.subarray( 0, vertOff ) ), ...( Dcircle.subarray( vertOff + 4 ) ) ] );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, Bcircle );
		gl.bufferData( gl.ARRAY_BUFFER, Dcircle, gl.DYNAMIC_DRAW );
		gl.bindBuffer( gl.ARRAY_BUFFER, Bvertex );
		gl.bufferData( gl.ARRAY_BUFFER, Dvertex, gl.STATIC_DRAW );
		
		circleCount--;
	}
	
	/*
	 * Arc init
	 */
	
	var arcInit = function () {
		arcProg = create_program_kun( arcv, arcf );
		gl.useProgram( arcProg );
		
		vertexNum = gl.getAttribLocation( arcProg, "vertexNum" );
		Uresolution = gl.getUniformLocation( arcProg, "Uresolution" );
		
		Acenter = gl.getAttribLocation( arcProg, "Acenter" );
		AR = gl.getAttribLocation( arcProg, "AR" );
		Aang1 = gl.getAttribLocation( arcProg, "Aang1" );
		Aang2 = gl.getAttribLocation( arcProg, "Aang2" );
		Acolor = gl.getAttribLocation( arcProg, "Acolor" );
		
		Bvertex = gl.createBuffer();
		Bcircle = gl.createBuffer();
		
		Dvertex = [];
		Dcircle = [];
	}
	
	/*
	 * Arc render
	 */
	
	var arcRender = function () {
		gl.useProgram( arcProg );
		gl.uniform2f( Uresolution, cv.width, cv.height );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, Bvertex );
		gl.vertexAttribPointer( vertexNum, 1, gl.FLOAT, false, 0, 0 );
		
		gl.bindBuffer( gl.ARRAY_BUFFER, Bcircle );
		gl.vertexAttribPointer( Acenter, 2, gl.FLOAT, false, 10 * 4, 0 );
		gl.vertexAttribPointer( AR, 2, gl.FLOAT, false, 10 * 4, 2 * 4 );
		gl.vertexAttribPointer( Aang1, 1, gl.FLOAT, false, 10 * 4, 4 * 4 );
		gl.vertexAttribPointer( Aang2, 1, gl.FLOAT, false, 10 * 4, 5 * 4 );
		gl.vertexAttribPointer( Acolor, 4, gl.FLOAT, false, 10 * 4, 6 * 4 );
		
		gl.enableVertexAttribArray( vertexNum );
		gl.enableVertexAttribArray( Acenter );
		gl.enableVertexAttribArray( AR );
		gl.enableVertexAttribArray( Aang1 );
		gl.enableVertexAttribArray( Aang2 );
		gl.enableVertexAttribArray( Acolor );
		
		gl.vertexAttribDivisor( Acenter, 1 );
		gl.vertexAttribDivisor( AR, 1 );
		gl.vertexAttribDivisor( Aang1, 1 );
		gl.vertexAttribDivisor( Aang2, 1 );
		gl.vertexAttribDivisor( Acolor, 1 );
		
		gl.drawArraysInstanced( gl.TRIANGLE_STRIP, 0, 4, circleCount );
		
		gl.vertexAttribDivisor( Acenter, 0 );
		gl.vertexAttribDivisor( AR, 0 );
		gl.vertexAttribDivisor( Aang1, 0 );
		gl.vertexAttribDivisor( Aang2, 0 );
		gl.vertexAttribDivisor( Acolor, 0 );
		
		gl.disableVertexAttribArray( vertexNum );
		gl.disableVertexAttribArray( Acenter );
		gl.disableVertexAttribArray( AR );
		gl.disableVertexAttribArray( Aang1 );
		gl.disableVertexAttribArray( Aang2 );
		gl.disableVertexAttribArray( Acolor );
	}
	
	return {
		arc : arcClass,
		init : arcInit,
		render: arcRender
	};
	
} )();

window.onload = init_kun;
