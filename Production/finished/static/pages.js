
const fn2 = () => {
	console.log( 'load' );
	const icon_docks = document.getElementsByClassName( 'icon-dock' );
	const icon_views = document.getElementsByClassName( 'icon-views' );
	for ( let ind = 0; ind < icon_docks.length; ind++ ) {
		const dock = icon_docks[ ind ];
		const views = icon_views[ ind ].children;
		console.log( dock );
		const icons = dock.getElementsByClassName( 'icon' );
		const return_bar = dock.getElementsByClassName( 'return-bar' )[ 0 ];
		let disp = -1;
		const ic_ev_fn = ( i ) => ( () => {
			console.log( `i = ${i}` );
			console.log( icons[ i ] );
			console.log( views[ i ] );
			dock.classList.add( 'dock-disp' );
			icons[ i ].classList.add( 'icon-disp' );
			views[ i ].classList.add( 'view-disp' );
			disp = i;
			return_bar.onclick = ret_ev_fn;
			for ( let i = 0; i < icons.length; i++ )
				icons[ i ].onclick = undefined;
		} );
		const ret_ev_fn = () => {
			dock.classList.remove( 'dock-disp' );
			if ( disp !== -1 ) {
				icons[ disp ].classList.remove( 'icon-disp' );
				views[ disp ].classList.remove( 'view-disp' );
			} else
				console.error( 'bug with icon docks' );
			disp = -1;
			return_bar.onclick = undefined;
			for ( let i = 0; i < icons.length; i++ )
				icons[ i ].onclick = ic_ev_fn( i );
		};
		for ( let i = 0; i < icons.length; i++ )
			icons[ i ].onclick = ic_ev_fn( i );
	}
};

window.addEventListener( 'load', fn2 );
