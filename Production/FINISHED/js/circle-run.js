 
/*
 * Circle Controller
 *
 * (c) Daniel Moylan 2021
 */

"use strict";

const circle = function () {

// Defines number of circles.
	const NUM_OF_CIRCLES = 5;
// Defines spin rates.
	const RESTING_SPIN_RATE = .2;
	const SPINNY_SPIN_RATE = 20;
	const OVER_SPIN_RATE = 0;
	const SPIN_TOLERANCE = 0.01;
// Defines radii attributes.
	let REST_R = Math.min( cw, ch ) / NUM_OF_CIRCLES * 1.5;
	let EXP_R = REST_R * 1.3;
// Defines circle array, gl buffer array, and gl interface
	const CIRCLE_ELMS = 9;
	const GL_CIRCLE_ELMS = 10;
	const circles = [];
	const circBuffer = new Float32Array( NUM_OF_CIRCLES * GL_CIRCLE_ELMS );
	const circGl = circle_gl( NUM_OF_CIRCLES );
// Defines colors for center and side
	const colorCenter = [ 0.745, 0.960, 0.976, 0.8 ];
	const colorSides = [ 0.745, 0.960, 0.976, 0.8 ];
// The index of the selected circle if such a circle is selected.
	const SELECTED_STATE = false;

	// Finds a center for circles
	const initCircles = () => {
		// PAD is distance from edges of screen, DIST is distance from circles, xOrig and yOrig are the (changing) initial positions for each circle.
		const PAD = EXP_R * 1.1;
		const DIST = ( EXP_R * 9 ) / ( NUM_OF_CIRCLES );
		let xOrig = 0;
		let yOrig = 0;
		// More consise.
		const relu = ( x ) => Math.max( x, 0 );

		// If width is smaller than height, set a varying x and fix y at the top or bottom.
		if ( canvas.width < canvas.height ) {
			xOrig = Math.random() * ( canvas.width - 2 * PAD ) + PAD;
			yOrig = Math.random() > 0.5 ? PAD : canvas.height - PAD;
		// Do the opposite for height > width.
		} else {
			yOrig = Math.random() * ( canvas.height - 2 * PAD ) + PAD;
			xOrig = Math.random() > 0.5 ? PAD : canvas.width - PAD;
		}

		const do_stuff = ( tries ) => {
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				let j = 0;
				let error = 50000000;	// big starting number

				// In case we can't, for whatever reason, get a perfect fit, we pick the least bad option.
				let bestCx = 0;
				let bestCy = 0;
				let bestError = error;

				while ( j++ < 40 && error > 0 ) {
					// Pick a random location on the circle surrounding the point.
					const angle = Math.random * Math.PI * 2;
					const cx = xOrig = DIST * Math.cos( angle );
					const cy = yOrig = DIST * Math.sin( angle );

					// Compute error, which is distance from the sides squared plus distance from circles squared.
					error = relu(PAD - cx) + relu(cx - (canvas.width - PAD)) + relu(PAD - cy) + relu(cy - (canvas.height - PAD));
					error *= error;
					for ( let k = 0; k < i; k++ ) {
						const x = cx - circles[ k * CIRCLE_ELMS ];
						const y = cy - circles[ k * CIRCLE_ELMS + 1 ];
						const squ = x * x + y * y;
						error += relu( DIST * DIST - squ );
					}

					if ( error < bestError ) {
						bestError = error;
						bestCx = cx;
						bestCy = cy;
					}
				}

				// If we don't get a good enough result, then try a different configuration.
				if ( bestError > 0 && tries > 0 )
					do_stuff( tries - 1 );

				// Text associated with circle.
				const text = document.getElementById( "circ" + i, text );
				//						center |   spin rate	|	r  | r goal | r' |  spin goal	| zeroed flag | text
				circles = [ ...circles, cx, cy, RESTING_SPIN_RATE, REST_R, REST_R, 0, RESTING_SPIN_RATE, false, text ];
				// Most fields are zero because they will be updated by resize. This is mainly just to reserve space for the fields and declare constants.
				circbuffer = [ ...circBuffer,
					0, 0, 0, 0, 0, 2 * Math.PI + 0.001, ...colorCenter,
					0, 0, 0, 0, 0, 0, ...colorSides,
					0, 0, 0, 0, 0, 0, ...colorSides
				];
			}
		}
	};

	// Updates circle r and spin with each animation frame based on values in circles array.
	this.update = ( dt ) => {
		// Every element of the circle array listed out by name.
		for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
			const cx = circles[ index * CIRCLE_ELMS + 0 ];
			const cy = circles[ index * CIRCLE_ELMS + 1 ];
			let spin = circles[ index * CIRCLE_ELMS + 2 ];
			let r = circles[ index * CIRCLE_ELMS + 3 ];
			const r_goal = circles[ index * CIRCLE_ELMS + 4 ];
			let r_p = circles[ index * CIRCLE_ELMS + 5 ];
			let spin_goal = circles[ index * CIRCLE_ELMS + 6 ];
			const zeroed = circles[ index * CIRCLE_ELMS + 7 ];

			// Spring equation for radius.
			const k_r = 0.00002;
			const damp = 1 - 0.04;
			const r_pp = k_r * ( r_goal - r );
			r_p = r_p * damp + r_pp * tDelta;
			r = r + r_p * tDelta;

			// If the radius is set to zero, it will go to zero and then come back and oscillate for a while due to the spring equation.
			// The 'zeroed' variable makes sure that if the radius is set to zero when naving, it does not bounce up (I just thought that looked really weird and didn't much care for it).
			if ( zeroed === true && r <= 0 ) {
				r_p = 0;
				r = 0;
			}

			// Spring equation for spin.
			let k_spin = 0.003;
			if ( spin_goal === SPINNY_SPIN_RATE )
				k_spin = 0.01;
			const spin_p = k_spin * ( spin_goal - spin );
			spin = spin + spin_p * tDelta;
			if ( spin >= spin_goal - SPIN_TOLERANCE && spin_goal === SPINNY_SPIN_RATE )
				spin_goal = OVER_SPIN_RATE;

			// Updating circles parameters...
			circles[ index * CIRCLE_ELMS + 5 ] = r_p;
			circles[ index * CIRCLE_ELMS + 3 ] = r;
			circles[ index * CIRCLE_ELMS + 2 ] = spin;
			circles[ index * CIRCLE_ELMS + 6 ] = spin_goal;

			// Updating circBuffer parameters...
			circBuffer[ index * GL_CIRCLE_ELMS * 3 + 2 ] = r * 0.65;
			circBuffer[ index * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS + 2 ] = r;
			circBuffer[ index * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS + 3 ] = r * 0.92;
			circBuffer[ index * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS * 2 + 2 ] = r;
			circBuffer[ index * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS * 2 + 3 ] = r * 0.92;

			// Fetch angles to add rate to them
			const one = circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS + 4 ];
			const two = circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS + 5 ];
			const thr = circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS * 2 + 4 ];
			const fou = circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS * 2 + 5 ];
			// Spin rate is in radians per sec, and we approximate that by accounting for passed time and converting to ms.
			const rate = spin * tDelta / 1000;
			// We load the angles into the array such that they don't go past 2 * Math.PI.
			circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS + 4 ] = clip( one + rate, 2 * Math.PI );
			circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS + 5 ] = clip( two + rate, 2 * Math.PI );
			circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS * 2 + 4 ] = clip( thr + rate, 2 * Math.PI );
			circBuffer[ GL_CIRCLE_ELMS * 3 * index + GL_CIRCLE_ELMS * 2 + 5 ] = clip( fou + rate, 2 * Math.PI );
		}
		// After we update, render the scene with GL.
		circGl.render( circBuffer );
	};

	/*
	 * EVENT HANDLING
	 */

	// Resizes (and updates) circles (redefine radii, circle centers, move text to circles, etc).
	this.resize = () => {
		// resize with gl
		circGl.resize();
		// Resize radii
		REST_R = Math.min( cw, ch ) / NUM_OF_CIRCLES * 1.5;
		EXP_R = REST_R * 1.3;
		// Manually trigger the mouse move event so we can update all of the circles' radii.
		this.mousemove( ( mx + 1 ) * cw, - ( my - 1 ) * ch );
		// Then we grow/shrink the circle center coordinates porportionally to the amount the screen did.
		const w_ratio = canvas.width / ow;
		const h_ratio = canvas.height / oh;

		for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
			// Update center
			circles[ i * CIRCLE_ELMS + 0 ] *= w_ratio;
			circles[ i * CIRCLE_ELMS + 1 ] *= h_ratio;
			const cx = circles[ i * CIRCLE_ELMS + 0 ];
			const cy = circles[ i * CIRCLE_ELMS + 1 ];
			// In gl buffer too
			circBuffer[ i * GL_CIRCLE_ELMS * 3 + 0 ] = cx;
			circBuffer[ i * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS ] = cx;
			circBuffer[ i * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS * 2 ] = cx;
			circBuffer[ i * GL_CIRCLE_ELMS * 3 + 1 ] = cy;
			circBuffer[ i * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS + 1 ] = cy;
			circBuffer[ i * GL_CIRCLE_ELMS * 3 + GL_CIRCLE_ELMS * 2 + 1 ] = cy;
			// Change text width
			const text = circles[ i * CIRCLE_ELMS + 8 ];
			text.style.width = 0.75 * REST_R;
			text.style.height = 0.75 * REST_R;
			// Also change the text position
			switch ( i + 1 ) {
				case 1: // Other Projects
					text.style.left = (circles[ i * CIRCLE_ELMS + 0 ] - circles[ i * CIRCLE_ELMS + 4 ] / 2) + 'px';
					text.style.top = (canvas.height - circles[ i * CIRCLE_ELMS + 1 ] - circles[ i * CIRCLE_ELMS + 4 ] / 2.4) + 'px';
					break;
				case 2: // This Site
					text.style.left = (circles[ i * CIRCLE_ELMS + 0 ] - circles[ i * CIRCLE_ELMS + 4 ] / 4) + 'px';
					text.style.top = (canvas.height - circles[ i * CIRCLE_ELMS + 1 ] - circles[ i * CIRCLE_ELMS + 4 ] / 2) + 'px';
					break;
				case 3: // About Me
					text.style.left = (circles[ i * CIRCLE_ELMS + 0 ] - circles[ i * CIRCLE_ELMS + 4 ] / 4) + 'px';
					text.style.top = (canvas.height - circles[ i * CIRCLE_ELMS + 1 ] - circles[ i * CIRCLE_ELMS + 4 ] / 2) + 'px';
					break;
				case 4: // Contact
					text.style.left = (circles[ i * CIRCLE_ELMS + 0 ] - circles[ i * CIRCLE_ELMS + 4 ] / 4) + 'px';
					text.style.top = (canvas.height - circles[ i * CIRCLE_ELMS + 1 ] - circles[ i * CIRCLE_ELMS + 4 ] / 2) + 'px';
					break;
				case 5: // My Blog
					text.style.left = (circles[ i * CIRCLE_ELMS + 0 ] - circles[ i * CIRCLE_ELMS + 4 ] / 4) + 'px';
					text.style.top = (canvas.height - circles[ i * CIRCLE_ELMS + 1 ] - circles[ i * CIRCLE_ELMS + 4 ] / 2) + 'px';
					break;
			}
		}
	};

	// This controls the circle mouse over effect.
	this.mousemove = ( mouse_x, mouse_y ) => {
		// Don't process event in selected state
		if ( SELECTED_STATE === false ) {
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				const cx = circles[ i * CIRCLE_ELMS + 0 ];
				const cy = circles[ i * CIRCLE_ELMS + 1 ];
				const r = circles[ i * CIRCLE_ELMS + 3 ];
				const adj_x = mouse_x - cx;
				const adj_y = mouse_y - cy;

				// Basically, if the mouse is found within the radius of any of the circles...
				if ( adj_x * adj_x + adj_y * adj_y <= r * r ) {
					// Then set our goal r to EXP_R...
					circles[ i * CIRCLE_ELMS + 4 ] = EXP_R;
					// and we set the spin goal to spinny if it is not already at the over rate.
					if ( circles[ i * CIRCLE_ELMS + 6 ] != OVER_SPIN_RATE )
						circles[ i * CIRCLE_ELMS + 6 ] = SPINNY_SPIN_RATE;
				} else {
					// Otherwise, we set the goals to resting values.
					circles[ i * CIRCLE_ELMS + 4 ] = REST_R;
					circles[ i * CIRCLE_ELMS + 6 ] = RESTING_SPIN_RATE;
				}
			}
		}
	};

	// Sets the circles' r and spin to their original defaults.
	this.reset = ( pageLeave ) => {
		// If we are normally navving, keep all circles at rest on nav away.
		if ( SELECTED_STATE === false ) {
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				// Set r_goal and spin_goal to start.
				circles[ i * CIRCLE_ELMS + 4 ] = REST_R;
				circles[ i * CIRCLE_ELMS + 6 ] = RESTING_SPIN_RATE;
				circles[ i * CIRCLE_ELMS + 7 ] = false;
				// Set r and spin to goal and r' to zero. This will stop any current motion and is used when leaving the page.
				if ( pageLeave === true ) {
					circles[ i * CIRCLE_ELMS + 5 ] = 0;
					circles[ i * CIRCLE_ELMS + 2 ] = RESTING_SPIN_RATE;
					circles[ i * CIRCLE_ELMS + 3 ] = REST_R;
				}
			}
		// If we aren't in nav mode, only keep the big displayed circle at rest.
		} else {
			circles[ SELECTED_STATE * CIRCLE_ELMS + 3 ] = circles[ SELECTED_STATE * CIRCLE_ELMS + 4 ];
			circles[ SELECTED_STATE * CIRCLE_ELMS + 5 ] = 0;
		}
	};

	// Focuses on one circle (specifically the circle at the offset 'index'.
	const select = ( index ) => {
		for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
			const cx = circles[ i * CIRCLE_ELMS + 0 ];
			const cy = circles[ i * CIRCLE_ELMS + 1 ];
			// If it's the focus circle...
			if ( i === index ) {
				// We want the circles to shrink before we expand the big circle.
				setTimeout( () => {
					// Get the radius the circle should be and set it.
					const max_x = canvas.width + Math.abs( cx - cw );
					const max_y = canvas.height + Math.abs( cy - ch );
					circles[ i * CIRCLE_ELMS + 4 ] = 1.1 * Math.sqrt( max_x * max_x + max_y * max_y );
					// Why not?
					circles[ i * CIRCLE_ELMS + 6 ] = 0;
				}, 500 );
			} else {
				// We still want a delay to wait for the text to fade out.
				setTimeout( () => {
					// Otherwise, zero the radius / spin and set the circle as 'zeroed' (see updateCircle).
					circles[ i * CIRCLE_ELMS + 4 ] = 0;
					circles[ i * CIRCLE_ELMS + 6 ] = 0;
					circles[ i * CIRCLE_ELMS + 7 ] = true;
				}, 200 );
			}

			// Fade out the text and turn it off after the fade is done.
			setTimeout( () => {
				circles[ i * CIRCLE_ELMS + 8 ].style.display = 'none';
			}, 300 );
			circles[ i * CIRCLE_ELMS + 8 ].className = 'circle-text fade-out';
		}

		// Disable mouse movement
		SELECTED_STATE = index;
	};

	// Click event for circles.
	this.click = ( mouse_x, mouse_y ) => {
		// SELECTED_STATE should not be true if this function is called.
		if ( SELECTED_STATE !== false ) {
			console.error( "circles.click should not be called when a circle is already selected." );
		}

		for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
			const cx = circles[ i * CIRCLE_ELMS + 0 ];
			const cy = circles[ i * CIRCLE_ELMS + 1 ];
			const r = circles[ i * CIRCLE_ELMS + 3 ];

			const adj_x = mouse_x - cx;
			const adj_y = mouse_y - cy;

			// If the pointer is in the radius of a circle
			if ( adj_x * adj_x + adj_y * adj_y <= r * r ) {
				// Then do the navigation animation and return the index of the clicked circle.
				select( i );
				return i;
			}
		}
		// -1 means no clicked circles.
		return -1;
	};

	// Resets the nav.
	this.deselect = () => {
		SELECTED_STATE = false;
		this.reset();
		setTimeout( () => {
			for ( let i = 0; i < NUM_OF_CIRCLES; i++ ) {
				circles[ i * CIRCLE_ELMS + 8 ].style.display = 'block';
				circles[ i * CIRCLE_ELMS + 8 ].className = 'circle-text fade-in';
			}
		}, 500 );
		this.mousemove( ( mx + 1 ) * cw, - ( my - 1 ) * ch );
	};
};
