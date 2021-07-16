#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;

vec2 Vcenter = vec2( u_resolution / 2. );
vec2 VR = vec2( 100., 50. );

void main () {
	vec3 color = vec3( 0., abs( cos( u_time ) ), abs( sin( u_time ) ) );
	vec2 R2 = VR * VR;

	vec2 diff = gl_FragCoord.xy - Vcenter;
	float dist = dot( diff, diff );
	
	#ifdef GL_OES_standard_derivatives
	float delta = fwidth( dist );
	delta = delta < 1. ? 1. : delta;
	float alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist ) - smoothstep( R2.y + delta, R2.y - delta, dist );

	gl_FragColor = vec4( color, alpha );
	#endif
}

