#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

#define PI radians( 180. )
#define TUPI radians( 360. )

precision mediump float;

uniform vec2 u_resolution;

vec2 Vcenter = vec2( u_resolution / 2. );
vec2 VR = vec2( 100., 50. );
float Vang1 = 3.1;
float Vang2 = 6.2;
vec4 Vcolor = vec4( 0.0, 1.0, 0.0, 1.0 );

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
    float delta = 100.;
    #endif

    float deltaT = 0.02;
    float alpha = 1.0 - smoothstep( R2.x - delta, R2.x + delta, dist )
                      - smoothstep( R2.y + delta, R2.y - delta, dist );

    if ( Vang2 <= TUPI ) {
        alpha = alpha - smoothstep( Vang1 + deltaT, Vang1 - deltaT, theta )
                      - smoothstep( Vang2 - deltaT, Vang2 + deltaT, theta );
    }

    gl_FragColor = vec4( Vcolor.rgb, Vcolor.a * alpha );
}
